import type { NextRequest } from "next/server";

const allowedRoots = new Set(["auth", "finance", "work"]);

async function forward(request: NextRequest, context: RouteContext<"/api/backend/[...path]">) {
  const base = (process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, "");
  if (!base) return Response.json({ detail: "Configura API_URL en el servidor." }, { status: 503 });

  const { path } = await context.params;
  if (!path.length || !allowedRoots.has(path[0]) || path.some((part) => part === ".." || part === ".")) {
    return Response.json({ detail: "Ruta no disponible." }, { status: 404 });
  }

  const target = `${base}/${path.map(encodeURIComponent).join("/")}${request.nextUrl.search}`;
  const headers = new Headers();
  for (const name of ["accept", "content-type", "cookie"]) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }

  try {
    const method = request.method.toUpperCase();
    const response = await fetch(target, {
      method,
      headers,
      body: method === "GET" || method === "HEAD" ? undefined : await request.arrayBuffer(),
      cache: "no-store",
      redirect: "manual",
    });
    const responseHeaders = new Headers();
    for (const name of ["content-type", "cache-control", "www-authenticate"]) {
      const value = response.headers.get(name);
      if (value) responseHeaders.set(name, value);
    }
    const cookie = response.headers.get("set-cookie");
    if (cookie) responseHeaders.set("set-cookie", cookie.replace(/;\s*Domain=[^;]*/i, ""));
    responseHeaders.set("Cache-Control", "no-store");
    return new Response(response.body, { status: response.status, headers: responseHeaders });
  } catch {
    return Response.json({ detail: "No se pudo conectar con el backend. Verifica API_URL." }, { status: 502 });
  }
}

export const GET = forward;
export const POST = forward;
export const DELETE = forward;
export const PATCH = forward;
export const PUT = forward;
