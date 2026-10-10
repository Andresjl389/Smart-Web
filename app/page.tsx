"use client";

import { useEffect, useMemo, useState } from "react";

type Section = "Resumen" | "Horas trabajadas" | "Finanzas";
type Account = { id: string; name: string; currency: string; type: string; initial_balance: string };
type Movement = { id: string; type: "income" | "expense" | "transfer"; amount: string; currency?: string; description: string | null; occurred_at: string; account_id: string; category_id: string | null };
type Session = { id: string; started_at: string; ended_at: string | null; minutes?: number | null; hours: number; note: string | null; is_open: boolean };
type Category = { id: string; name: string; is_active: boolean };
type AccountBalance = { account: Account; balance: string };
type FinanceSummary = { income: string; expense: string; balance: string };
type WorkSummary = { total_minutes: number; total_hours: number; sessions: number };
const API = "/api/backend";
const colors = ["#635bff", "#0e9f83", "#ed7d3a", "#db5278", "#3c7bd6"];

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API}${path}`, { ...init, credentials: "include", headers: { Accept: "application/json", ...(init?.body ? { "Content-Type": "application/json" } : {}), ...init?.headers } });
  if (!response.ok) {
    if (response.status === 401 && typeof window !== "undefined") window.dispatchEvent(new Event("smart-auth-expired"));
    let message = response.status === 401 ? "Sesión no válida. Inicia sesión de nuevo." : `No se pudo completar la solicitud (${response.status}).`;
    try { const payload = await response.json(); if (typeof payload.detail === "string") message = payload.detail; else if (Array.isArray(payload.detail)) message = payload.detail.map((item: { msg?: string }) => item.msg).filter(Boolean).join(" · ") || message; } catch {}
    throw new Error(message);
  }
  return response.status === 204 ? undefined as T : response.json();
}

function Icon({ name, size = 19 }: { name: string; size?: number }) {
  const paths: Record<string, React.ReactNode> = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
    wallet: <><rect x="3" y="5" width="18" height="15" rx="2"/><path d="M3 9h18M16 15h2"/><path d="M6 5V3h12v2"/></>,
    chevron: <path d="m9 18 6-6-6-6"/>, plus: <path d="M12 5v14M5 12h14"/>, arrow: <path d="M7 17 17 7M7 7h10v10"/>,
    down: <path d="m7 10 5 5 5-5"/>, settings: <><circle cx="12" cy="12" r="3"/><path d="m19.4 15 .1.1 1.2.9-1.2 2.1-1.4-.6a8 8 0 0 1-1.7 1l-.2 1.5h-2.4l-.3-1.5a8 8 0 0 1-1.7-1l-1.4.6-1.2-2.1 1.2-.9a8 8 0 0 1 0-2l-1.2-.9 1.2-2.1 1.4.6a8 8 0 0 1 1.7-1l.3-1.5h2.4l.2 1.5a8 8 0 0 1 1.7 1l1.4-.6 1.2 2.1-1.2.9a8 8 0 0 1-.1 2Z" transform="translate(-2 -1)"/></>,
    search: <><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 4 4"/></>, bell: <><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></>,
    logout: <><path d="M10 17l5-5-5-5M15 12H3"/><path d="M12 3h7a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-7"/></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] || paths.grid}</svg>;
}

export default function Home() {
  const [section, setSection] = useState<Section>("Resumen");
  const [user, setUser] = useState<{ id?: string; email: string } | null>(null);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authOpen, setAuthOpen] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [chartMovements, setChartMovements] = useState<Movement[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [weekSessions, setWeekSessions] = useState<Session[]>([]);
  const [current, setCurrent] = useState<Session | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [accountBalances, setAccountBalances] = useState<AccountBalance[]>([]);
  const [financeSummary, setFinanceSummary] = useState<FinanceSummary | null>(null);
  const [workSummary, setWorkSummary] = useState<WorkSummary | null>(null);
  const [weekSummary, setWeekSummary] = useState<WorkSummary | null>(null);
  const [sessionRange, setSessionRange] = useState<"Semana" | "Mes">("Semana");
  const [tab, setTab] = useState("Semana");
  const [modal, setModal] = useState<"movement" | "account" | null>(null);
  const [movementType, setMovementType] = useState<"income" | "expense" | "transfer">("expense");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const [accent, setAccent] = useState("#635bff");
  const [customize, setCustomize] = useState(false);
  const [search, setSearch] = useState("");
  const [now, setNow] = useState(0);
  const [checkingSession, setCheckingSession] = useState(Boolean(API));
  const notify = (text: string) => { setNotice(text); window.setTimeout(() => setNotice(""), 3500); };

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const saved = localStorage.getItem("smart-accent"); if (saved) setAccent(saved);
      setNow(Date.now());
    });
    if (!API) return;
    api<{ email: string; id: string }>("/auth/me").then(setUser).catch(() => setAuthOpen(true)).finally(() => setCheckingSession(false));
    return () => window.cancelAnimationFrame(frame);
  }, []);
  useEffect(() => {
    const expireSession = () => { setUser(null); setAuthOpen(true); setAccounts([]); setMovements([]); setChartMovements([]); setSessions([]); setWeekSessions([]); setCurrent(null); setAccountBalances([]); setFinanceSummary(null); setWorkSummary(null); setWeekSummary(null); };
    window.addEventListener("smart-auth-expired", expireSession);
    return () => window.removeEventListener("smart-auth-expired", expireSession);
  }, []);
  useEffect(() => { document.documentElement.style.setProperty("--accent", accent); localStorage.setItem("smart-accent", accent); }, [accent]);
  useEffect(() => { if (!current) return; const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer); }, [current]);
  useEffect(() => {
    if (!API || !user) return;
    const nowDate = new Date(); const monthStart = new Date(nowDate.getFullYear(), nowDate.getMonth(), 1);
    const monthSince = encodeURIComponent(monthStart.toISOString());
    const until = encodeURIComponent(nowDate.toISOString());
    Promise.allSettled([
      api<Account[]>("/finance/accounts"), api<AccountBalance[]>("/finance/accounts/balances?only_active=true"),
      api<Category[]>("/finance/categories?only_active=true"), api<Movement[]>(`/finance/movements?since=${monthSince}&until=${until}&limit=500`),
      api<FinanceSummary>(`/finance/summary?since=${monthSince}&until=${until}`),
      api<Session | null>("/work/sessions/current"),
    ]).then(([a,b,c,m,f,currentSession]) => {
      if (a.status === "fulfilled") setAccounts(a.value); if (b.status === "fulfilled") setAccountBalances(b.value); if (c.status === "fulfilled") setCategories(c.value);
      if (m.status === "fulfilled") setMovements(m.value); if (f.status === "fulfilled") setFinanceSummary(f.value);
      if (currentSession.status === "fulfilled") setCurrent(currentSession.value);
      const failures = [a,b,c,m,f,currentSession].filter(result => result.status === "rejected").length;
      if (failures) notify(`${failures} sección(es) no pudieron cargar. Revisa la conexión y vuelve a iniciar sesión.`);
    });
  }, [user]);
  useEffect(() => {
    if (!API || !user) return;
    const untilDate = new Date(); const start = new Date(untilDate);
    if (sessionRange === "Semana") { start.setHours(0,0,0,0); start.setDate(start.getDate() - ((start.getDay() + 6) % 7)); }
    else { start.setDate(1); start.setHours(0,0,0,0); }
    const since = encodeURIComponent(start.toISOString()); const until = encodeURIComponent(untilDate.toISOString());
    Promise.all([api<Session[]>(`/work/sessions?since=${since}&until=${until}&limit=500`), api<WorkSummary>(`/work/summary?since=${since}&until=${until}`)])
      .then(([sessionList, summary]) => { setSessions(sessionList); setWorkSummary(summary); if (sessionRange === "Semana") { setWeekSessions(sessionList); setWeekSummary(summary); } })
      .catch(error => notify(error instanceof Error ? error.message : "No se pudieron cargar las horas."));
  }, [user, sessionRange]);
  useEffect(() => {
    if (!API || !user) return;
    const end = new Date(); const start = new Date(end);
    if (tab === "Semana") { start.setHours(0,0,0,0); start.setDate(start.getDate() - ((start.getDay() + 6) % 7)); }
    else if (tab === "Mes") { start.setDate(1); start.setHours(0,0,0,0); }
    else { start.setMonth(0,1); start.setHours(0,0,0,0); }
    api<Movement[]>(`/finance/movements?since=${encodeURIComponent(start.toISOString())}&until=${encodeURIComponent(end.toISOString())}&limit=500`)
      .then(setChartMovements).catch(error => notify(error instanceof Error ? error.message : "No se pudo actualizar el gráfico."));
  }, [tab, user]);

  const money = (n: number | string, currency = "COP") => new Intl.NumberFormat("es-CO", { style: "currency", currency, maximumFractionDigits: 0 }).format(Number(n));
  const balanceByCurrency = accountBalances.reduce<Record<string, number>>((totals, item) => { totals[item.account.currency] = (totals[item.account.currency] || 0) + Number(item.balance); return totals; }, {});
  const totalBalance = accountBalances.length ? accountBalances.reduce((sum, item) => sum + Number(item.balance), 0) : financeSummary ? Number(financeSummary.balance) : accounts.reduce((sum, a) => sum + Number(a.initial_balance), 0) + movements.reduce((sum, m) => sum + (m.type === "income" ? Number(m.amount) : m.type === "expense" ? -Number(m.amount) : 0), 0);
  const balanceLabel = Object.keys(balanceByCurrency).length > 1 ? Object.entries(balanceByCurrency).map(([currency, amount]) => new Intl.NumberFormat("es-CO", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount)).join(" · ") : money(totalBalance, Object.keys(balanceByCurrency)[0] || "COP");
  const liveHours = current ? Math.max(0, (now - new Date(current.started_at).getTime()) / 3600000) : 0;
  const totalHours = (workSummary?.total_hours ?? sessions.filter(s => !s.is_open).reduce((sum, s) => sum + s.hours, 0)) + liveHours;
  const weeklyTotalHours = (weekSummary?.total_hours ?? weekSessions.filter(s => !s.is_open).reduce((sum, s) => sum + s.hours, 0)) + liveHours;
  const activityBuckets = useMemo(() => makeActivityBuckets(chartMovements, tab, now), [chartMovements, tab, now]);
  const maxActivity = Math.max(1, ...activityBuckets.flatMap(bucket => [bucket.income, bucket.expense]));
  const chartPoints = (key: "income" | "expense") => activityBuckets.map((bucket, index) => `${activityBuckets.length < 2 ? 350 : index * 700 / (activityBuckets.length - 1)},${180 - bucket[key] / maxActivity * 155}`).join(" ");
  const weeklyHours = useMemo(() => {
    const days = [0,0,0,0,0,0,0];
    for (const session of weekSessions) { if (session.is_open) continue; const day = (new Date(session.started_at).getDay() + 6) % 7; days[day] += session.hours; }
    if (current) days[(new Date(current.started_at).getDay() + 6) % 7] += Math.max(0, (now - new Date(current.started_at).getTime()) / 3600000);
    return days;
  }, [weekSessions, current, now]);
  const maxWeekHours = Math.max(1, ...weeklyHours);
  const filtered = useMemo(() => movements.filter(m => (m.description || "").toLowerCase().includes(search.toLowerCase())), [movements, search]);
  async function refreshFinance() {
    if (!API) return;
    const nowDate = new Date(); const monthStart = new Date(nowDate.getFullYear(), nowDate.getMonth(), 1);
    const since = encodeURIComponent(monthStart.toISOString()); const until = encodeURIComponent(nowDate.toISOString());
    const chartStart = new Date(nowDate);
    if (tab === "Semana") { chartStart.setHours(0,0,0,0); chartStart.setDate(chartStart.getDate() - ((chartStart.getDay() + 6) % 7)); }
    else if (tab === "Mes") { chartStart.setDate(1); chartStart.setHours(0,0,0,0); }
    else { chartStart.setMonth(0,1); chartStart.setHours(0,0,0,0); }
    const [accountList, balances, categoryList, movementList, summary] = await Promise.all([
      api<Account[]>("/finance/accounts"), api<AccountBalance[]>("/finance/accounts/balances?only_active=true"),
      api<Category[]>("/finance/categories?only_active=true"), api<Movement[]>(`/finance/movements?since=${since}&until=${until}&limit=500`),
      api<FinanceSummary>(`/finance/summary?since=${since}&until=${until}`),
    ]);
    const chartList = await api<Movement[]>(`/finance/movements?since=${encodeURIComponent(chartStart.toISOString())}&until=${until}&limit=500`);
    setAccounts(accountList); setAccountBalances(balances); setCategories(categoryList); setMovements(movementList); setChartMovements(chartList); setFinanceSummary(summary);
  }

  async function authenticate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true);
    const data = new FormData(event.currentTarget); const email = String(data.get("email")); const password = String(data.get("password"));
    try {
      const result = await api<{ id: string; email: string }>(`/auth/${authMode}`, { method: "POST", body: JSON.stringify({ email, password }) });
      const authenticatedUser = authMode === "register" ? await api<{ id: string; email: string }>("/auth/me") : result;
      setUser(authenticatedUser); setAuthOpen(false); notify("Sesión iniciada correctamente.");
    } catch (error) { notify(error instanceof Error ? error.message : "No se pudo iniciar sesión."); } finally { setLoading(false); }
  }
  async function refreshWork() {
    const end = new Date(); const periodStart = new Date(end);
    if (sessionRange === "Semana") { periodStart.setHours(0,0,0,0); periodStart.setDate(periodStart.getDate() - ((periodStart.getDay() + 6) % 7)); }
    else { periodStart.setDate(1); periodStart.setHours(0,0,0,0); }
    const weekStart = new Date(end); weekStart.setHours(0,0,0,0); weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
    const periodSince = encodeURIComponent(periodStart.toISOString()); const weekSince = encodeURIComponent(weekStart.toISOString()); const until = encodeURIComponent(end.toISOString());
    const [periodSessions, periodSummary, weeklySessions, weeklySummary, running] = await Promise.all([
      api<Session[]>(`/work/sessions?since=${periodSince}&until=${until}&limit=500`), api<WorkSummary>(`/work/summary?since=${periodSince}&until=${until}`),
      api<Session[]>(`/work/sessions?since=${weekSince}&until=${until}&limit=500`), api<WorkSummary>(`/work/summary?since=${weekSince}&until=${until}`), api<Session | null>("/work/sessions/current"),
    ]);
    setSessions(periodSessions); setWorkSummary(periodSummary); setWeekSessions(weeklySessions); setWeekSummary(weeklySummary); setCurrent(running);
  }
  async function refreshAll() {
    if (!user) return;
    try { await Promise.all([refreshFinance(), refreshWork()]); notify("Datos actualizados."); }
    catch (error) { notify(error instanceof Error ? error.message : "No se pudieron actualizar los datos."); }
  }
  async function toggleClock() {
    if (loading) return; setLoading(true);
    try {
      if (current) { await api<Session>("/work/sessions/stop", { method: "POST", body: JSON.stringify({}) }); setCurrent(null); await refreshWork(); notify("Jornada finalizada."); }
      else { const started = await api<Session>("/work/sessions/start", { method: "POST", body: JSON.stringify({ note: "Trabajo del día" }) }); setCurrent(started); await refreshWork(); notify("Cronómetro en marcha."); }
    } catch (error) { notify(error instanceof Error ? error.message : "No se pudo actualizar el cronómetro."); } finally { setLoading(false); }
  }
  async function addMovement(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (loading) return; setLoading(true);
    const data = new FormData(event.currentTarget); const amount = String(data.get("amount")); const description = String(data.get("description")) || null;
    try {
      if (movementType === "transfer") {
        const from_account_id = String(data.get("from_account")); const to_account_id = String(data.get("to_account"));
        if (from_account_id === to_account_id) throw new Error("Selecciona cuentas diferentes para la transferencia.");
        await api<Movement>("/finance/transfers", { method: "POST", body: JSON.stringify({ amount, from_account_id, to_account_id, description }) });
      } else {
        const payload = { type: movementType, amount, account_id: String(data.get("account")), description, category_id: String(data.get("category")) || null };
        await api<Movement>("/finance/movements", { method: "POST", body: JSON.stringify(payload) });
      }
      setModal(null); await refreshFinance(); notify(movementType === "transfer" ? "Transferencia registrada." : "Movimiento guardado.");
    } catch (error) { notify(error instanceof Error ? error.message : "No se pudo guardar el movimiento."); } finally { setLoading(false); }
  }
  async function addAccount(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (loading) return; setLoading(true);
    const data = new FormData(event.currentTarget); const payload = { name: String(data.get("name")), type: String(data.get("type")), currency: "COP", initial_balance: String(data.get("balance") || "0") };
    try { await api<Account>("/finance/accounts", { method: "POST", body: JSON.stringify(payload) }); setModal(null); await refreshFinance(); notify("Cuenta creada."); }
    catch (error) { notify(error instanceof Error ? error.message : "No se pudo crear la cuenta."); } finally { setLoading(false); }
  }  async function deleteMovement(movement: Movement) {
    if (!window.confirm("¿Eliminar este movimiento?")) return;
    try { await api<void>(`/finance/movements/${movement.id}`, { method: "DELETE" }); await refreshFinance(); notify("Movimiento eliminado."); }
    catch (error) { notify(error instanceof Error ? error.message : "No se pudo eliminar el movimiento."); }
  }
  async function deleteAccount(account: Account) {
    if (!window.confirm(`¿Eliminar la cuenta «${account.name}»?`)) return;
    try { await api<void>(`/finance/accounts/${account.id}`, { method: "DELETE" }); await refreshFinance(); notify("Cuenta eliminada."); }
    catch (error) { notify(error instanceof Error ? error.message : "No se pudo eliminar la cuenta."); }
  }
  async function deleteSession(session: Session) {
    if (!window.confirm("¿Eliminar este registro de horas?")) return;
    try { await api<void>(`/work/sessions/${session.id}`, { method: "DELETE" }); await refreshWork(); notify("Registro eliminado."); }
    catch (error) { notify(error instanceof Error ? error.message : "No se pudo eliminar el registro."); }
  }
  async function logout() {
    try { await api<void>("/auth/logout", { method: "POST" }); }
    catch (error) { notify(error instanceof Error ? error.message : "No se pudo cerrar sesión."); }
    finally { setUser(null); setAccounts([]); setMovements([]); setChartMovements([]); setSessions([]); setWeekSessions([]); setCategories([]); setAccountBalances([]); setCurrent(null); setFinanceSummary(null); setWorkSummary(null); setWeekSummary(null); setAuthOpen(true); }
  }
  const nav: { label: Section; icon: string }[] = [{ label: "Resumen", icon: "grid" }, { label: "Horas trabajadas", icon: "clock" }, { label: "Finanzas", icon: "wallet" }];
  return <main className="app-shell">
    <aside className="sidebar">
      <a className="brand" href="#inicio"><span className="brand-mark"><span/><span/><span/><span/></span><span>SmartApp<span className="brand-dot">.</span></span></a>
      <div className="workspace-switch"><div className="workspace-avatar">N</div><div className="workspace-copy"><b>Mi espacio</b><span>Espacio personal</span></div><Icon name="down" size={15}/></div>
      <div className="side-label">ESPACIO DE TRABAJO</div>
      <nav className="nav-list">{nav.map(item => <button key={item.label} className={`nav-item ${section === item.label ? "selected" : ""}`} onClick={() => setSection(item.label)}><Icon name={item.icon}/><span>{item.label}</span>{section === item.label && <i/>}</button>)}</nav>
      <div className="side-label tools-label">PREFERENCIAS</div>
      <button className={`nav-item ${customize ? "selected" : ""}`} onClick={() => setCustomize(!customize)}><Icon name="settings"/><span>Personalizar</span></button>
      <div className="sidebar-bottom"><div className="help-card"><div className="help-icon">✦</div><b>Un espacio a tu manera</b><p>Organiza tu trabajo y tus finanzas en un mismo lugar.</p><button onClick={() => setCustomize(true)}>Personalizar espacio <Icon name="chevron" size={14}/></button></div>
        <button className="profile" onClick={() => user ? logout() : setAuthOpen(true)}><div className="profile-avatar">{user?.email?.[0]?.toUpperCase() || "A"}</div><div className="profile-copy"><b>{user?.email?.split("@")[0] || "Alex Morgan"}</b><span>{user?.email || "Plan personal"}</span></div><Icon name={user ? "logout" : "down"} size={16}/></button>
      </div>
    </aside>
    <section className="main-area">
      <header className="topbar"><div className="breadcrumb">Mi espacio <Icon name="chevron" size={14}/><b>{section}</b></div><div className="top-actions"><label className="search-box"><Icon name="search" size={17}/><input placeholder="Buscar en tu espacio..." value={search} onChange={e => setSearch(e.target.value)}/><kbd>⌘ K</kbd></label><div className="top-divider"/><button className="today-pill" onClick={refreshAll} disabled={!user}><span className="green-dot"/> {current ? "Jornada en curso · Actualizar" : user ? "Conectado · Actualizar" : "Sin sesión"}</button></div></header>
      <div className="page-content">
        <div className="welcome-row"><div><div className="eyebrow"><span className="eyebrow-line"/> {now ? new Intl.DateTimeFormat("es-CO", { weekday: "long", day: "numeric", month: "long" }).format(new Date(now)) : ""}</div><h1>{section === "Resumen" ? <>Buenos días, {user?.email?.split("@")[0] || "Alex"} <span className="wave">✳</span></> : section}</h1><p className="subtitle">{section === "Resumen" ? "Este es el resumen de tu espacio. Todo en orden para hoy." : section === "Horas trabajadas" ? "Cuida tu tiempo y mantén el ritmo de trabajo." : "Ten claridad sobre cómo se mueve tu dinero."}</p></div><button className="primary-btn" onClick={() => { if (section === "Horas trabajadas") toggleClock(); else if (section === "Finanzas") setModal("movement"); else { setSection("Horas trabajadas"); toggleClock(); } }}>{section === "Horas trabajadas" ? <><span className="play-icon">{current ? "■" : "▶"}</span>{current ? "Finalizar jornada" : "Iniciar jornada"}</> : <><Icon name="plus" size={17}/>{section === "Finanzas" ? "Añadir movimiento" : current ? "Finalizar jornada" : "Iniciar jornada"}</>}</button></div>
        {customize && <div className="customize-panel"><div><b>Personaliza tu espacio</b><p>Elige un color para los botones y detalles.</p></div><div className="color-options">{colors.map(c => <button key={c} aria-label={`Color ${c}`} className={`color-swatch ${accent === c ? "active" : ""}`} style={{ "--swatch": c } as React.CSSProperties} onClick={() => setAccent(c)}/>)}</div><label className="custom-color">Otro color<input type="color" value={accent} onChange={e => setAccent(e.target.value)}/></label><button className="close-custom" onClick={() => setCustomize(false)}>Listo</button></div>}

        {section === "Resumen" && <>
          <div className="stats-grid">
            <article className="stat-card balance-card"><div className="stat-top"><span>Balance total</span><span className="stat-icon purple-icon"><Icon name="wallet" size={17}/></span></div><div className="stat-value">{balanceLabel}</div><div className="stat-foot">Saldo actual de tus cuentas</div></article>
            <article className="stat-card"><div className="stat-top"><span>Horas esta semana</span><span className="stat-icon orange-icon"><Icon name="clock" size={17}/></span></div><div className="stat-value">{weeklyTotalHours.toFixed(1)}<small> h</small></div><div className="stat-foot">{weekSummary?.sessions ?? weekSessions.length} sesiones registradas</div></article>
            <article className="stat-card"><div className="stat-top"><span>Ingresos del mes</span><span className="stat-icon green-icon"><Icon name="arrow" size={17}/></span></div><div className="stat-value">{money(financeSummary?.income ?? 0)}</div><div className="stat-foot">Acumulado del mes actual</div></article>
          </div>
          <div className="dashboard-grid">
            <section className="panel activity-panel">
              <div className="panel-heading"><div><h2>Actividad financiera</h2><p>Ingresos y gastos registrados</p></div><select className="select-pill" value={tab} onChange={e => setTab(e.target.value)}><option>Semana</option><option>Mes</option><option>Año</option></select></div>
              <div className="chart-legend"><span><i className="legend-income"/> Ingresos</span><span><i className="legend-expense"/> Gastos</span><small>{tab === "Semana" ? "Esta semana" : tab === "Mes" ? "Este mes" : "Este año"}</small></div>
              <div className="chart-wrap"><div className="y-labels"><span>{moneyCompact(maxActivity)}</span><span>{moneyCompact(maxActivity * .66)}</span><span>{moneyCompact(maxActivity * .33)}</span><span>$0</span></div><div className="chart"><div className="gridline g1"/><div className="gridline g2"/><div className="gridline g3"/><div className="gridline g4"/><svg viewBox="0 0 700 190" preserveAspectRatio="none" className="chart-svg"><defs><linearGradient id="incomeFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="var(--accent)" stopOpacity=".18"/><stop offset="1" stopColor="var(--accent)" stopOpacity="0"/></linearGradient></defs><polygon points={`0,180 ${chartPoints("income")} 700,180`} fill="url(#incomeFill)"/><polyline points={chartPoints("income")} fill="none" stroke="var(--accent)" strokeWidth="3" vectorEffect="non-scaling-stroke"/><polyline points={chartPoints("expense")} fill="none" stroke="#f0a36e" strokeWidth="2.5" strokeDasharray="5 5" vectorEffect="non-scaling-stroke"/></svg><div className="x-labels">{activityBuckets.map((bucket, index)=><span key={`${bucket.label}-${index}`}>{bucket.label}</span>)}</div></div></div>
            </section>
            <section className="panel hours-panel"><div className="panel-heading"><div><h2>Tu semana</h2><p>Horas registradas por día</p></div><span className="more-btn">{weekSummary?.sessions ?? weekSessions.length} sesiones</span></div><div className="hours-total">{weeklyTotalHours.toFixed(1)} <span>h</span><small>Acumulado de lunes a domingo</small></div><div className="week-bars">{weeklyHours.map((h,i)=><div className="day-bar" key={i}><div className="bar-track"><div className={`bar-fill ${i === ((new Date(now || 0).getDay() + 6) % 7) ? "today-bar" : ""}`} style={{height:`${Math.max(3,h/maxWeekHours*100)}%`}}/></div><span>{["L","M","X","J","V","S","D"][i]}</span></div>)}</div><div className="goal-line"><span>Meta semanal</span><b>35 h</b></div><div className="goal-progress"><span style={{width:`${Math.min(100,weeklyTotalHours/35*100)}%`}}/></div><p className="goal-note">{Math.max(0,35-weeklyTotalHours).toFixed(1)} h para completar la meta semanal.</p></section>
          </div>          <section className="panel recent-panel"><div className="panel-heading"><div><h2>Movimientos recientes</h2><p>Tus últimas transacciones registradas</p></div><button className="text-button" onClick={() => setSection("Finanzas")}>Ver todos <Icon name="chevron" size={15}/></button></div><MovementTable items={filtered.slice(0,4)} accounts={accounts} money={money} categories={categories} onDelete={deleteMovement}/></section>
        </>}
        {section === "Horas trabajadas" && <>
          <div className="stats-grid hours-stats">
            <article className="stat-card"><div className="stat-top"><span>{sessionRange === "Semana" ? "Horas esta semana" : "Horas este mes"}</span><span className="stat-icon purple-icon"><Icon name="clock"/></span></div><div className="stat-value">{totalHours.toFixed(1)}<small> h</small></div><div className="stat-foot">Tiempo registrado en el periodo</div></article>
            <article className="stat-card"><div className="stat-top"><span>Sesiones</span><span className="stat-icon orange-icon">◷</span></div><div className="stat-value">{workSummary?.sessions ?? sessions.length}</div><div className="stat-foot">En el periodo seleccionado</div></article>
            <article className="stat-card timer-card"><div className="stat-top"><span>Jornada actual</span><span className={`live-dot ${current ? "is-live" : ""}`}/></div><div className="stat-value timer-value">{current ? elapsed(current.started_at, now) : "00:00:00"}</div><button className={`clock-action ${current ? "stop-action" : ""}`} onClick={toggleClock} disabled={loading}>{current ? "■ Finalizar jornada" : "▶ Iniciar jornada"}</button></article>
          </div>
          <section className="panel recent-panel"><div className="panel-heading"><div><h2>Registro de horas</h2><p>Consulta tus sesiones y elimina registros incorrectos.</p></div><select className="select-pill" value={sessionRange} onChange={e=>setSessionRange(e.target.value as typeof sessionRange)}><option value="Semana">Esta semana</option><option value="Mes">Este mes</option></select></div><div className="sessions-list">{sessions.filter(s => (s.note || "").toLowerCase().includes(search.toLowerCase())).map(s=><div className="session-row" key={s.id}><div className="session-date"><b>{new Intl.DateTimeFormat("es-CO",{day:"2-digit"}).format(new Date(s.started_at))}</b><span>{new Intl.DateTimeFormat("es-CO",{month:"short"}).format(new Date(s.started_at))}</span></div><div className="session-details"><b>{s.note || "Sesión de trabajo"}</b><span>{new Intl.DateTimeFormat("es-CO",{weekday:"long",hour:"2-digit",minute:"2-digit"}).format(new Date(s.started_at))}{s.ended_at ? ` – ${new Intl.DateTimeFormat("es-CO",{hour:"2-digit",minute:"2-digit"}).format(new Date(s.ended_at))}` : " · En curso"}</span></div><div className="session-duration">{s.is_open ? "En curso" : `${s.hours.toFixed(1)} h`}</div>{!s.is_open && <button className="row-delete" onClick={() => deleteSession(s)} aria-label="Eliminar registro de horas">Eliminar</button>}</div>)}{!sessions.length && <div className="empty-sessions">No hay sesiones registradas en este periodo.</div>}</div></section>
        </>}        {section === "Finanzas" && <><div className="stats-grid finance-stats"><article className="stat-card balance-card"><div className="stat-top"><span>Balance total</span><span className="stat-icon purple-icon"><Icon name="wallet"/></span></div><div className="stat-value">{balanceLabel}</div><div className="stat-foot">Saldo actual de tus cuentas</div></article><article className="stat-card"><div className="stat-top"><span>Ingresos</span><span className="stat-icon green-icon"><Icon name="arrow"/></span></div><div className="stat-value">{money(financeSummary?.income ?? movements.filter(m=>m.type==="income").reduce((sum,movement)=>sum+Number(movement.amount),0))}</div><div className="stat-foot">Este mes</div></article><article className="stat-card"><div className="stat-top"><span>Gastos</span><span className="stat-icon orange-icon"><Icon name="arrow"/></span></div><div className="stat-value">{money(financeSummary?.expense ?? movements.filter(m=>m.type==="expense").reduce((sum,movement)=>sum+Number(movement.amount),0))}</div><div className="stat-foot">Este mes</div></article></div><section className="panel accounts-panel"><div className="panel-heading"><div><h2>Tus cuentas</h2><p>Un vistazo a tus saldos disponibles</p></div><button className="secondary-btn" onClick={() => setModal("account")}><Icon name="plus" size={15}/> Añadir cuenta</button></div><div className="accounts-grid">{accounts.map((a,i)=><div className="account-card" key={a.id}><div className="account-card-top"><span className={`account-symbol account-symbol-${i%3}`}>{a.type==="cash"?"$":a.type==="savings"?"◉":"▣"}</span><span className="account-kind">{a.type === "bank" ? "Cuenta bancaria" : a.type === "savings" ? "Ahorros" : a.type}</span><button className="row-delete" onClick={() => deleteAccount(a)}>Eliminar</button></div><b>{a.name}</b><div className="account-balance">{money(accountBalances.find(balance => balance.account.id === a.id)?.balance ?? a.initial_balance, a.currency)}</div><span className="account-number">{a.currency} ·· ···· 2841</span></div>)}<button className="add-account-card" onClick={() => setModal("account")}><span><Icon name="plus"/></span>Añadir una cuenta</button></div></section><section className="panel recent-panel"><div className="panel-heading"><div><h2>Todos los movimientos</h2><p>Consulta y filtra tus transacciones</p></div><button className="secondary-btn" onClick={() => setModal("movement")}><Icon name="plus" size={15}/> Añadir movimiento</button></div><MovementTable items={filtered} accounts={accounts} money={money} categories={categories} onDelete={deleteMovement}/></section></>}
        <footer className="page-footer"><span>Hecho para trabajar con más claridad.</span><span>Ayudaã€€·ã€€Privacidadã€€·ã€€© 2025 Nexo</span></footer>
      </div>
    </section>
    {notice && <div className="toast"><span>✓</span>{notice}</div>}
    {checkingSession && <div className="modal-backdrop"><div className="modal-card session-check"><div className="modal-brand">SmartApp</div><h2>Conectando con tu espacio</h2><p>Verificando tu sesión con el backend…</p></div></div>}
    {authOpen && <div className="modal-backdrop" onClick={() => !API && setAuthOpen(false)}><form className="modal-card" onSubmit={authenticate} onClick={e=>e.stopPropagation()}><button className="modal-close" type="button" disabled={!!API} onClick={()=>setAuthOpen(false)}>×</button><div className="modal-brand"><span className="brand-mark"><span/><span/><span/><span/></span> SmartApp<span className="brand-dot">.</span></div><h2>{authMode === "login" ? "Qué bueno verte de nuevo" : "Crea tu espacio"}</h2><p>Ingresa tus datos para continuar.</p><label>Correo electrónico<input required name="email" type="email" placeholder="tu@correo.com"/></label><label>Contraseña<input required name="password" type="password" minLength={8} placeholder="Mínimo 8 caracteres"/></label><button className="primary-btn modal-submit" disabled={loading}>{loading ? "Un momento…" : authMode === "login" ? "Iniciar sesión" : "Crear cuenta"}</button><div className="switch-auth">{authMode === "login" ? "¿Aún no tienes cuenta?" : "¿Ya tienes cuenta?"} <button type="button" onClick={()=>setAuthMode(authMode === "login" ? "register" : "login")}>{authMode === "login" ? "Regístrate" : "Inicia sesión"}</button></div></form></div>}
    {modal && <div className="modal-backdrop" onClick={() => setModal(null)}><form className="modal-card" onSubmit={modal === "movement" ? addMovement : addAccount} onClick={e=>e.stopPropagation()}><button className="modal-close" type="button" onClick={()=>setModal(null)}>×</button><div className="modal-brand">{modal === "movement" ? "Finanzas" : "Cuentas"}</div><h2>{modal === "movement" ? "Añadir movimiento" : "Añadir cuenta"}</h2><p>{modal === "movement" ? "Registra un ingreso, gasto o transferencia." : "Organiza tus saldos en un mismo lugar."}</p>{modal === "movement" ? <><label>Tipo<select value={movementType} onChange={e=>setMovementType(e.target.value as typeof movementType)}><option value="expense">Gasto</option><option value="income">Ingreso</option><option value="transfer">Transferencia</option></select></label><label>Descripción<input name="description" placeholder="Ej. Pago de cliente"/></label><label>Monto<input name="amount" type="number" min="1" required placeholder="0"/></label>{movementType === "transfer" ? <><label>Desde<select name="from_account" required>{accounts.map(a=><option value={a.id} key={a.id}>{a.name}</option>)}</select></label><label>Hacia<select name="to_account" required>{accounts.map(a=><option value={a.id} key={a.id}>{a.name}</option>)}</select></label></> : <><label>Cuenta<select name="account" required>{accounts.map(a=><option value={a.id} key={a.id}>{a.name}</option>)}</select></label><label>Categoría<select name="category"><option value="">Sin categoría</option>{categories.map(category=><option value={category.id} key={category.id}>{category.name}</option>)}</select></label></>}</> : <><label>Nombre de la cuenta<input name="name" required placeholder="Ej. Cuenta principal"/></label><label>Tipo<select name="type"><option value="bank">Cuenta bancaria</option><option value="savings">Ahorros</option><option value="cash">Efectivo</option><option value="card">Tarjeta</option><option value="other">Otro</option></select></label><label>Saldo inicial<input name="balance" type="number" min="0" defaultValue="0"/></label></>}{modal === "movement" && accounts.length === 0 && <p className="demo-hint">Crea primero una cuenta para registrar movimientos.</p>}<button className="primary-btn modal-submit" disabled={loading || (modal === "movement" && accounts.length === 0)}><Icon name="plus" size={16}/> Guardar</button></form></div>}
  </main>;
}

function elapsed(started: string, now = Date.now()) { const sec = Math.floor((now - new Date(started).getTime()) / 1000); return [Math.floor(sec/3600),Math.floor(sec%3600/60),sec%60].map(n=>String(n).padStart(2,"0")).join(":"); }
function moneyCompact(value: number) { return new Intl.NumberFormat("es-CO", { notation: "compact", maximumFractionDigits: 1 }).format(value); }
function makeActivityBuckets(items: Movement[], range: string, timestamp: number) {
  const anchor = new Date(timestamp || 0);
  if (range === "Año") {
    const buckets = Array.from({ length: 12 }, (_, month) => ({ label: new Intl.DateTimeFormat("es-CO", { month: "short" }).format(new Date(anchor.getFullYear(), month, 1)), income: 0, expense: 0 }));
    for (const item of items) { const date = new Date(item.occurred_at); if (Number.isNaN(date.getTime())) continue; if (item.type !== "transfer") buckets[date.getMonth()][item.type] += Number(item.amount); }
    return buckets;
  }
  if (range === "Mes") {
    const daysInMonth = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0).getDate();
    const size = Math.ceil(daysInMonth / 7);
    const buckets = Array.from({ length: 7 }, (_, index) => ({ label: String(index * size + 1), income: 0, expense: 0 }));
    for (const item of items) { const date = new Date(item.occurred_at); if (Number.isNaN(date.getTime()) || item.type === "transfer") continue; const index = Math.min(6, Math.floor((date.getDate() - 1) / size)); buckets[index][item.type] += Number(item.amount); }
    return buckets;
  }
  const monday = new Date(anchor); monday.setHours(0,0,0,0); monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const buckets = Array.from({ length: 7 }, (_, day) => ({ label: ["L","M","X","J","V","S","D"][day], income: 0, expense: 0 }));
  for (const item of items) {
    const date = new Date(item.occurred_at); if (Number.isNaN(date.getTime()) || item.type === "transfer") continue;
    const day = Math.floor((new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime() - monday.getTime()) / 86400000);
    if (day >= 0 && day < 7) buckets[day][item.type] += Number(item.amount);
  }
  return buckets;
}
function MovementTable({ items, accounts, categories, money, onDelete }: { items: Movement[]; accounts: Account[]; categories: Category[]; money: (n: number | string, currency?: string) => string; onDelete: (movement: Movement) => void }) {
  return <div className="table-scroll"><table className="movement-table"><thead><tr><th>DESCRIPCION</th><th>CATEGORIA</th><th>CUENTA</th><th>FECHA</th><th className="amount-head">MONTO</th><th></th></tr></thead><tbody>{items.length ? items.map(m=><tr key={m.id}><td><div className={`movement-avatar ${m.type}`}>{m.type === "income" ? "↙" : m.type === "transfer" ? "⇄" : "↗"}</div><div className="movement-name"><b>{m.description || (m.type === "income" ? "Ingreso" : m.type === "expense" ? "Gasto" : "Transferencia")}</b><span>{m.type === "income" ? "Ingreso" : m.type === "expense" ? "Gasto" : "Transferencia"}</span></div></td><td><span className="category-chip">{categories.find(category => category.id === m.category_id)?.name || (m.type === "income" ? "Ingresos" : m.type === "expense" ? "General" : "Transferencia")}</span></td><td>{accounts.find(a=>a.id===m.account_id)?.name || "Cuenta"}</td><td>{new Intl.DateTimeFormat("es-CO",{day:"numeric",month:"short",year:"numeric"}).format(new Date(m.occurred_at))}</td><td className={`amount-cell ${m.type === "income" ? "positive" : ""}`}>{m.type === "income" ? "+ " : "− "}{money(m.amount, m.currency || "COP")}</td><td><button className="row-delete" onClick={() => onDelete(m)} aria-label="Eliminar movimiento">Eliminar</button></td></tr>) : <tr><td colSpan={6} className="empty-cell">No hay movimientos en este periodo o busqueda.</td></tr>}</tbody></table></div>;
}







