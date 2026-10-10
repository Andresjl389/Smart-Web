import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SmartApp · Tu espacio de trabajo",
  description: "Organiza tu tiempo y tus finanzas en un mismo lugar.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
