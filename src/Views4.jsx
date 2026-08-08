import { useState, useEffect } from "react";
import { fmtMoney, todayStr, uid, DAYS } from "./core.js";

const C = { ink: "#0f1f13", forest: "#1B3A1F", moss: "#3f7a33", field: "#79bd56",
  paper: "#f7f3ed", card: "#ffffff", line: "#e2ddd2", stone: "#5c6a5e",
  alert: "#b3402e", alertBg: "#fbeeea", amber: "#a06a12", amberBg: "#faf3e3" };

const inputStyle = { width: "100%", padding: "11px 12px", fontSize: 15, border: `1px solid ${C.line}`,
  borderRadius: 8, fontFamily: "inherit", boxSizing: "border-box" };

// Full-screen sheet — mobile-first. Fixed overlay so it works the same whether
// the underlying list is long or short.
export function Sheet({ title, onClose, children, footer }) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(15,31,19,.45)",
      zIndex: 200, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div onClick={e => e.stopPropagation()} style={{ background: C.paper, width: "100%", maxWidth: 720,
        maxHeight: "92vh", overflowY: "auto", borderRadius: "16px 16px 0 0", padding: 16, boxSizing: "border-box" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ fontFamily: "Georgia,serif", fontSize: 19, fontWeight: 700 }}>{title}</div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 26, lineHeight: 1,
            color: C.stone, cursor: "pointer", padding: "0 4px" }}>&times;</button>
        </div>
        {children}
        {footer && <div style={{ marginTop: 14 }}>{footer}</div>}
      </div>
    </div>
  );
}

// ─── CLIENT EDIT ─────────────────────────────────────────────────────────
export function ClientEditSheet({ client, upd, showToast, onClose }) {
  const [f, setF] = useState({ ...client });
  const [confirmDelete, setConfirmDelete] = useState(false);
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));
  const toggleDay = i => setF(p => ({ ...p,
    scheduleDays: (p.scheduleDays || []).includes(i)
      ? p.scheduleDays.filter(x => x !== i) : [...(p.scheduleDays || []), i] }));

  const save = () => {
    if (!String(f.name || "").trim()) { showToast("Name required", "err"); return; }
    upd(d => ({ ...d, clients: d.clients.map(c => c.id === client.id
      ? { ...f, name: String(f.name).trim(), rate: Number(f.rate) || 0 } : c) }));
    showToast("Client updated"); onClose();
  };

  const remove = () => {
    // Visits are deliberately kept: deleting a client must never erase income
    // history, or the tax numbers silently change.
    upd(d => ({ ...d, clients: d.clients.filter(c => c.id !== client.id),
      plannedStops: (d.plannedStops || []).filter(s => s.clientId !== client.id) }));
    showToast("Client removed — past visits kept for your records"); onClose();
  };

  return (
    <Sheet title="Edit client" onClose={onClose} footer={
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={save} style={{ flex: 2, background: C.forest, color: "#fff", border: "none",
          borderRadius: 10, padding: 13, fontWeight: 700, fontSize: 15, cursor: "pointer", fontFamily: "inherit" }}>Save</button>
        <button onClick={() => { if (confirmDelete) remove(); else setConfirmDelete(true); }}
          style={{ flex: 1, background: confirmDelete ? C.alert : "#fff", color: confirmDelete ? "#fff" : C.alert,
            border: `1px solid ${C.alert}`, borderRadius: 10, padding: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
          {confirmDelete ? "Confirm?" : "Delete"}
        </button>
      </div>}>
      <input style={inputStyle} placeholder="Name" value={f.name || ""} onChange={e => set("name", e.target.value)} />
      <div style={{ height: 8 }} />
      <input style={inputStyle} placeholder="Address" value={f.address || ""} onChange={e => set("address", e.target.value)} />
      <div style={{ height: 8 }} />
      <input style={inputStyle} placeholder="Phone" type="tel" value={f.phone || ""} onChange={e => set("phone", e.target.value)} />
      <div style={{ height: 8 }} />
      <div style={{ display: "flex", gap: 8 }}>
        <input style={inputStyle} placeholder="Rate $" type="number" value={f.rate ?? ""} onChange={e => set("rate", e.target.value)} />
        <input style={inputStyle} placeholder="Zone" value={f.zone || ""} onChange={e => set("zone", e.target.value)} />
      </div>
      <div style={{ height: 10 }} />
      <div style={{ fontSize: 11.5, fontWeight: 800, color: C.stone, textTransform: "uppercase", marginBottom: 5 }}>Frequency</div>
      <div style={{ display: "flex", gap: 5 }}>
        {[["weekly", "Weekly"], ["biweekly", "Biweekly"], ["monthly", "Monthly"], ["oneoff", "One-off"]].map(([v, l]) => (
          <button key={v} onClick={() => set("frequency", v)} style={{ flex: 1, padding: "8px 4px", borderRadius: 8,
            fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
            border: `1px solid ${f.frequency === v ? C.forest : C.line}`,
            background: f.frequency === v ? C.forest : "#fff", color: f.frequency === v ? "#fff" : C.stone }}>{l}</button>
        ))}
      </div>
      <div style={{ height: 10 }} />
      <div style={{ fontSize: 11.5, fontWeight: 800, color: C.stone, textTransform: "uppercase", marginBottom: 5 }}>Service days</div>
      <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
        {DAYS.map((dn, i) => (
          <button key={dn} onClick={() => toggleDay(i)} style={{ padding: "7px 11px", borderRadius: 16, fontSize: 12,
            fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
            border: `1px solid ${(f.scheduleDays || []).includes(i) ? C.forest : C.line}`,
            background: (f.scheduleDays || []).includes(i) ? C.forest : "#fff",
            color: (f.scheduleDays || []).includes(i) ? "#fff" : C.stone }}>{dn}</button>
        ))}
      </div>
      <div style={{ height: 10 }} />
      <textarea placeholder="Notes — gate codes, dogs, where to start…" value={f.notes || ""}
        onChange={e => set("notes", e.target.value)}
        style={{ ...inputStyle, height: 76, resize: "vertical" }} />
    </Sheet>
  );
}

// ─── VISIT / SERVICE EDIT ────────────────────────────────────────────────
export function VisitEditSheet({ visit, clientName, upd, showToast, onClose }) {
  const [f, setF] = useState({ ...visit });
  const [confirmDelete, setConfirmDelete] = useState(false);
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));
  const SERVICES = ["Mow", "Trim", "Edge", "Blow", "Cleanup", "Hedge"];
  const toggleSvc = s => setF(p => {
    const cur = p.servicesDone || [];
    return { ...p, servicesDone: cur.includes(s) ? cur.filter(x => x !== s) : [...cur, s] };
  });

  const save = () => {
    const amt = Number(f.amount);
    if (!Number.isFinite(amt) || amt < 0) { showToast("Enter a valid amount", "err"); return; }
    upd(d => ({ ...d, visits: d.visits.map(v => v.id === visit.id ? {
      ...f, amount: amt,
      // Cash-basis: a paid visit must always carry a payment date, since
      // every income figure is derived from paidDate, not the service date.
      paidDate: f.paid ? (f.paidDate || todayStr()) : null,
    } : v) }));
    showToast("Service updated"); onClose();
  };

  const remove = () => {
    upd(d => ({ ...d, visits: d.visits.filter(v => v.id !== visit.id) }));
    showToast("Service deleted"); onClose();
  };

  return (
    <Sheet title="Edit service" onClose={onClose} footer={
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={save} style={{ flex: 2, background: C.forest, color: "#fff", border: "none",
          borderRadius: 10, padding: 13, fontWeight: 700, fontSize: 15, cursor: "pointer", fontFamily: "inherit" }}>Save</button>
        <button onClick={() => { if (confirmDelete) remove(); else setConfirmDelete(true); }}
          style={{ flex: 1, background: confirmDelete ? C.alert : "#fff", color: confirmDelete ? "#fff" : C.alert,
            border: `1px solid ${C.alert}`, borderRadius: 10, padding: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
          {confirmDelete ? "Confirm?" : "Delete"}
        </button>
      </div>}>
      <div style={{ fontSize: 13.5, color: C.stone, marginBottom: 10 }}>{clientName}</div>
      <div style={{ display: "flex", gap: 8 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11.5, fontWeight: 800, color: C.stone, textTransform: "uppercase", marginBottom: 4 }}>Service date</div>
          <input style={inputStyle} type="date" value={f.date || ""} onChange={e => set("date", e.target.value)} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11.5, fontWeight: 800, color: C.stone, textTransform: "uppercase", marginBottom: 4 }}>Amount</div>
          <input style={inputStyle} type="number" value={f.amount ?? ""} onChange={e => set("amount", e.target.value)} />
        </div>
      </div>
      <div style={{ height: 10 }} />
      <div style={{ fontSize: 11.5, fontWeight: 800, color: C.stone, textTransform: "uppercase", marginBottom: 5 }}>Work done</div>
      <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
        {SERVICES.map(s => (
          <button key={s} onClick={() => toggleSvc(s)} style={{ padding: "7px 12px", borderRadius: 16, fontSize: 12,
            fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
            border: `1px solid ${(f.servicesDone || []).includes(s) ? C.moss : C.line}`,
            background: (f.servicesDone || []).includes(s) ? C.moss : "#fff",
            color: (f.servicesDone || []).includes(s) ? "#fff" : C.stone }}>{s}</button>
        ))}
      </div>
      <div style={{ height: 12 }} />
      <div style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 10, padding: 12 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
          <input type="checkbox" checked={!!f.paid} onChange={e => set("paid", e.target.checked)}
            style={{ width: 20, height: 20 }} />
          <span style={{ fontWeight: 700, fontSize: 14.5 }}>Paid</span>
        </label>
        {f.paid && (
          <div style={{ marginTop: 10 }}>
            <div style={{ fontSize: 11.5, fontWeight: 800, color: C.stone, textTransform: "uppercase", marginBottom: 4 }}>
              Date collected — this is the date income counts on
            </div>
            <input style={inputStyle} type="date" value={f.paidDate || todayStr()}
              onChange={e => set("paidDate", e.target.value)} />
          </div>
        )}
      </div>
    </Sheet>
  );
}

// ─── MESSAGE TEMPLATES + SMS COMPOSER ────────────────────────────────────
// Templates are functions of the real record so the message is already
// accurate — the operator edits tone, never re-types facts.

// Payment handles, rendered only when the operator has filled them in — an
// empty "Pay me at:" header with nothing under it looks worse than no header.
const payBlock = biz => {
  const lines = [];
  if (biz.venmo)   lines.push(`Venmo: ${biz.venmo}`);
  if (biz.cashapp) lines.push(`Cash App: ${biz.cashapp}`);
  if (biz.zelle)   lines.push(`Zelle: ${biz.zelle}`);
  return lines.length ? `\n\nEasiest ways to pay:\n${lines.join("\n")}` : "";
};

export const TEMPLATES = [
  { id: "receipt", label: "Receipt",
    build: (c, v, biz) =>
`${c.name.split(" ")[0]}, receipt for ${fmtDate(v.date)}:

${(v.servicesDone || ["Mow","Trim","Blow"]).join(", ")} — ${fmtMoney(v.amount)}
Paid ${v.paidDate ? fmtDate(v.paidDate) : "today"} — thank you!

${biz.name}
${biz.phone || ""}`.trim() },

  { id: "thanks", label: "Thank you + referral",
    build: (c, v, biz) =>
`Thanks for having me out today, ${c.name.split(" ")[0]} — the yard looked good when I left.

If you know a neighbor who needs the same, I'd appreciate you passing my number along.

${biz.name}
${biz.phone || ""}`.trim() },

  { id: "both", label: "Receipt + thank you",
    build: (c, v, biz) =>
`${c.name.split(" ")[0]}, receipt for ${fmtDate(v.date)}:

${(v.servicesDone || ["Mow","Trim","Blow"]).join(", ")} — ${fmtMoney(v.amount)}
Paid ${v.paidDate ? fmtDate(v.paidDate) : "today"}

Thanks for the business — if a neighbor needs the same, feel free to pass my number along.

${biz.name}
${biz.phone || ""}`.trim() },

  { id: "reminder", label: "Payment reminder",
    build: (c, v, biz) =>
`Hi ${c.name.split(" ")[0]} — just a friendly reminder on the ${fmtDate(v.date)} service:

${(v.servicesDone || ["Mow","Trim","Blow"]).join(", ")} — ${fmtMoney(v.amount)}

Whenever you get a chance, no rush. Thanks!${payBlock(biz)}

${biz.name}
${biz.phone || ""}`.trim() },

  { id: "invoice", label: "Invoice / amount due",
    build: (c, v, biz) =>
`${c.name.split(" ")[0]}, here's what's due for ${fmtDate(v.date)}:

${(v.servicesDone || ["Mow","Trim","Blow"]).join(", ")}
Amount due: ${fmtMoney(v.amount)}${payBlock(biz)}

Thanks!
${biz.name}
${biz.phone || ""}`.trim() },

  { id: "heads_up", label: "Heads up — coming tomorrow",
    build: (c, v, biz) =>
`Hi ${c.name.split(" ")[0]} — planning to be out tomorrow for the yard.

If you can make sure the gate's unlocked and pets are inside, that'd help a lot. Thanks!

${biz.name}`.trim() },
];

const fmtDate = iso => {
  if (!iso) return "";
  const d = new Date(iso + "T12:00:00");
  return isNaN(d) ? iso : d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

export function MessageSheet({ client, visit, business, onClose, showToast }) {
  const [tplId, setTplId] = useState(visit && !visit.paid ? "reminder" : "receipt");
  const [text, setText] = useState("");

  // Rebuild the draft whenever the template changes, but never stomp an edit
  // the operator already made — that's the whole point of "edit before send".
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    if (dirty) return;
    const t = TEMPLATES.find(x => x.id === tplId);
    setText(t ? t.build(client, visit || { date: todayStr(), amount: client.rate, servicesDone: null }, business) : "");
  }, [tplId, dirty, client, visit, business]);

  const digits = String(client.phone || "").replace(/\D/g, "");
  // sms: with a prefilled body — `?&body=` is the form that works on both
  // iOS and Android; using only ? or only & breaks one of the two.
  const smsHref = `sms:${digits}?&body=${encodeURIComponent(text)}`;

  const copy = async () => {
    try { await navigator.clipboard.writeText(text); showToast("Message copied"); }
    catch { showToast("Couldn't copy — select the text manually", "err"); }
  };

  return (
    <Sheet title="Send a message" onClose={onClose} footer={
      <div style={{ display: "flex", gap: 8 }}>
        <a href={digits ? smsHref : undefined}
          onClick={e => { if (!digits) { e.preventDefault(); showToast("No phone number on this client", "err"); } else { onClose(); } }}
          style={{ flex: 2, textAlign: "center", background: digits ? C.forest : "#ccc", color: "#fff",
            borderRadius: 10, padding: 13, fontWeight: 700, fontSize: 15, textDecoration: "none", fontFamily: "inherit" }}>
          Open in Messages
        </a>
        <button onClick={copy} style={{ flex: 1, background: "#fff", color: C.forest, border: `1px solid ${C.line}`,
          borderRadius: 10, padding: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Copy</button>
      </div>}>
      <div style={{ fontSize: 13.5, color: C.stone, marginBottom: 10 }}>
        To {client.name}{client.phone ? ` · ${client.phone}` : " · no phone on file"}
      </div>
      <div style={{ fontSize: 11.5, fontWeight: 800, color: C.stone, textTransform: "uppercase", marginBottom: 5 }}>Template</div>
      <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 10 }}>
        {TEMPLATES.map(t => (
          <button key={t.id} onClick={() => { setTplId(t.id); setDirty(false); }}
            style={{ padding: "7px 11px", borderRadius: 16, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
              border: `1px solid ${tplId === t.id ? C.forest : C.line}`,
              background: tplId === t.id ? C.forest : "#fff", color: tplId === t.id ? "#fff" : C.stone }}>{t.label}</button>
        ))}
      </div>
      <textarea value={text} onChange={e => { setText(e.target.value); setDirty(true); }}
        style={{ ...inputStyle, height: 190, resize: "vertical", lineHeight: 1.45 }} />
      <div style={{ fontSize: 11.5, color: C.stone, marginTop: 6 }}>
        Edit anything above before sending. Tapping a template resets the draft.
      </div>
    </Sheet>
  );
}
