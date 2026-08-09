import { useState, useEffect, useMemo, useRef } from "react";
import { db, migrate, blankState, todayStr, isoOf, mondayOf, weekDates, dowOf,
  fmtShort, fmtMoney, DAYS, DAYS_FULL, uid, priceQuote, marginCheck } from "./core.js";
import { TodayView, WeekView } from "./Views1.jsx";
import { ClientsView, QuoteView } from "./Views2.jsx";
import { TaxView, SettingsView } from "./Views3.jsx";

// ─── ICONS (inline SVG, zero dependencies) ─────────────────────────────────
const Ic = ({ n, s = 18, c = "currentColor" }) => {
  const p = { width: s, height: s, viewBox: "0 0 24 24", fill: "none", stroke: c, strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" };
  const paths = {
    home: <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />,
    calendar: <><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M3 10h18M8 2v4M16 2v4"/></>,
    users: <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></>,
    dollar: <><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></>,
    truck: <><rect x="1" y="3" width="15" height="13"/><path d="M16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></>,
    wrench: <path d="M14.7 6.3a4 4 0 1 1-5.4 5.4L2 19l3 3 7.3-7.3a4 4 0 1 1 5.4-5.4L21 6l-3-3-3.3 3.3z"/>,
    plus: <><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></>,
    x: <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>,
    check: <polyline points="20 6 9 17 4 12"/>,
    back: <polyline points="15 18 9 12 15 6"/>,
    search: <><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></>,
    map: <><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/></>,
    file: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></>,
    alert: <><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></>,
  };
  return <svg {...p}>{paths[n] || null}</svg>;
};

// ─── COLOR SYSTEM ───────────────────────────────────────────────────────────
const C = {
  ink: "#0f1f13", forest: "#1B3A1F", moss: "#3f7a33", field: "#79bd56",
  paper: "#f7f3ed", card: "#ffffff", line: "#e2ddd2", stone: "#5c6a5e",
  alert: "#b3402e", alertBg: "#fbeeea", amber: "#a06a12", amberBg: "#faf3e3",
  okBg: "#eef6e9",
};

const Btn = ({ children, onClick, variant = "primary", style = {}, disabled }) => {
  const base = { border: "none", borderRadius: 10, padding: "12px 18px", fontSize: 14.5,
    fontWeight: 700, cursor: disabled ? "default" : "pointer", fontFamily: "inherit",
    opacity: disabled ? 0.5 : 1, display: "inline-flex", alignItems: "center", gap: 7 };
  const variants = {
    primary: { background: C.forest, color: "#fff" },
    ghost: { background: "transparent", color: C.forest, border: `1px solid ${C.line}` },
    danger: { background: C.alertBg, color: C.alert, border: `1px solid ${C.alert}` },
  };
  return <button onClick={disabled ? undefined : onClick} style={{ ...base, ...variants[variant], ...style }} disabled={disabled}>{children}</button>;
};

const Card = ({ children, style = {}, onClick }) => (
  <div onClick={onClick} style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 12,
    padding: 14, cursor: onClick ? "pointer" : "default", ...style }}>{children}</div>
);

const Field = ({ label, children }) => (
  <div style={{ marginBottom: 12 }}>
    <label style={{ display: "block", fontSize: 11.5, fontWeight: 800, letterSpacing: ".05em",
      textTransform: "uppercase", color: C.stone, marginBottom: 5 }}>{label}</label>
    {children}
  </div>
);

const inputStyle = { width: "100%", padding: "11px 12px", fontSize: 15, border: `1px solid ${C.line}`,
  borderRadius: 8, fontFamily: "inherit", boxSizing: "border-box" };

// ═══════════════════════════════════════════════════════════════════════════
export default function App() {
  const [data, setData] = useState(null);
  const [tab, setTab] = useState("today");
  const [toast, setToast] = useState(null);

  useEffect(() => { setData(migrate(db.load())); }, []);
  useEffect(() => { if (data) db.save(data); }, [data]);

  const upd = fn => setData(d => fn(d));
  const showToast = (msg, kind = "ok") => { setToast({ msg, kind }); setTimeout(() => setToast(null), 2200); };

  if (!data) return <div style={{ padding: 40, textAlign: "center", color: C.stone }}>Loading…</div>;

  const activeClients = data.clients.filter(c => c.status !== "inactive");

  return (
    <div style={{ fontFamily: "-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif", background: C.paper, minHeight: "100vh", color: C.ink }}>
      <header style={{ background: C.forest, color: "#fff", padding: "18px 16px 14px" }}>
        <div style={{ fontFamily: "Georgia,serif", fontSize: 24, fontWeight: 700 }}>{data.business.name}</div>
        <div style={{ fontSize: 12, color: "#9db496", marginTop: 2 }}>
          {DAYS_FULL[new Date().getDay()]} · {activeClients.length} clients
        </div>
      </header>

      <nav style={{ display: "flex", background: "#fff", borderBottom: `1px solid ${C.line}`, overflowX: "auto" }}>
        {[["today", "Today", "home"], ["week", "Week", "calendar"], ["clients", "Clients", "users"],
          ["quote", "Quote", "dollar"], ["tax", "Tax", "file"],
          ["settings", "Setup", "wrench"]].map(([id, lbl, icon]) => (
          <button key={id} onClick={() => setTab(id)} style={{
            flex: "1 0 auto", padding: "12px 10px", background: "none", border: "none",
            borderBottom: tab === id ? `3px solid ${C.field}` : "3px solid transparent",
            color: tab === id ? C.forest : C.stone, fontWeight: tab === id ? 800 : 500,
            fontSize: 12, display: "flex", flexDirection: "column", alignItems: "center", gap: 3, cursor: "pointer", fontFamily: "inherit" }}>
            <Ic n={icon} s={17} c={tab === id ? C.forest : C.stone} />{lbl}
          </button>
        ))}
      </nav>

      <main style={{ padding: 14, paddingBottom: 80, maxWidth: 720, margin: "0 auto" }}>
        {tab === "today" && <TodayView data={data} upd={upd} showToast={showToast} />}
        {tab === "week" && <WeekView data={data} upd={upd} showToast={showToast} />}
        {tab === "clients" && <ClientsView data={data} upd={upd} showToast={showToast} />}
        {tab === "quote" && <QuoteView data={data} upd={upd} showToast={showToast} />}
        {tab === "tax" && <TaxView data={data} upd={upd} showToast={showToast} />}
        {tab === "settings" && <SettingsView data={data} upd={upd} showToast={showToast} />}
      </main>

      {toast && <div style={{ position: "fixed", bottom: 20, left: "50%", transform: "translateX(-50%)",
        background: toast.kind === "err" ? C.alert : C.forest, color: "#fff", padding: "10px 20px",
        borderRadius: 10, fontSize: 14, fontWeight: 700, boxShadow: "0 4px 16px rgba(0,0,0,.2)", zIndex: 100 }}>
        {toast.msg}
      </div>}
    </div>
  );
}
