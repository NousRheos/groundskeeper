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
export function ClientEditSheet({ client, upd, showToast, onClose, isNew }) {
  const [f, setF] = useState({ ...client });
  const [confirmDelete, setConfirmDelete] = useState(false);
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));
  const toggleDay = i => setF(p => ({ ...p,
    scheduleDays: (p.scheduleDays || []).includes(i)
      ? p.scheduleDays.filter(x => x !== i) : [...(p.scheduleDays || []), i] }));

  const save = () => {
    const nm = String(f.name || "").trim();
    if (!nm) { showToast("Name required", "err"); return; }
    const rec = { ...f, name: nm, rate: Number(f.rate) || 0 };
    upd(d => {
      if (isNew) {
        // Dedupe guard so a double-tap can't create the same client twice.
        if (d.clients.some(c => c.name.toLowerCase() === nm.toLowerCase())) return d;
        return { ...d, clients: [rec, ...d.clients] };
      }
      return { ...d, clients: d.clients.map(c => c.id === client.id ? rec : c) };
    });
    showToast(isNew ? "Client added" : "Client updated"); onClose();
  };

  const remove = () => {
    // Visits are deliberately kept: deleting a client must never erase income
    // history, or the tax numbers silently change.
    upd(d => ({ ...d, clients: d.clients.filter(c => c.id !== client.id),
      plannedStops: (d.plannedStops || []).filter(s => s.clientId !== client.id) }));
    showToast("Client removed — past visits kept for your records"); onClose();
  };

  return (
    <Sheet title={isNew ? "New client" : "Edit client"} onClose={onClose} footer={
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={save} style={{ flex: 2, background: C.forest, color: "#fff", border: "none",
          borderRadius: 10, padding: 13, fontWeight: 700, fontSize: 15, cursor: "pointer", fontFamily: "inherit" }}>Save</button>
        {!isNew && <button onClick={() => { if (confirmDelete) remove(); else setConfirmDelete(true); }}
          style={{ flex: 1, background: confirmDelete ? C.alert : "#fff", color: confirmDelete ? "#fff" : C.alert,
            border: `1px solid ${C.alert}`, borderRadius: 10, padding: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
          {confirmDelete ? "Confirm?" : "Delete"}
        </button>}
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


// ─── CLIENT DETAIL — what you want in hand when a client calls ───────────
export function ClientDetailSheet({ client, data, onClose, onEdit, onText, onEditVisit }) {
  const visits = data.visits.filter(v => v.clientId === client.id)
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  const paid = visits.filter(v => v.paid).reduce((s, v) => s + Number(v.amount || 0), 0);
  const owed = visits.filter(v => !v.paid).reduce((s, v) => s + Number(v.amount || 0), 0);
  const timed = visits.filter(v => Number(v.durationMin) > 0);
  const avgMin = timed.length ? Math.round(timed.reduce((s, v) => s + Number(v.durationMin), 0) / timed.length) : null;
  const digits = String(client.phone || "").replace(/\D/g, "");

  const stat = (label, value, color) => (
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: ".05em", textTransform: "uppercase", color: C.stone }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 800, color: color || C.ink }}>{value}</div>
    </div>
  );

  return (
    <Sheet title={client.name} onClose={onClose} footer={
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={onEdit} style={{ flex: 1, background: "#fff", color: C.forest, border: `1px solid ${C.line}`,
          borderRadius: 10, padding: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Edit</button>
        <button onClick={onText} style={{ flex: 1, background: C.moss, color: "#fff", border: "none",
          borderRadius: 10, padding: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Text</button>
        {digits && <a href={`tel:${digits}`} style={{ flex: 1, textAlign: "center", background: C.forest, color: "#fff",
          borderRadius: 10, padding: 13, fontWeight: 700, textDecoration: "none", fontFamily: "inherit" }}>Call</a>}
      </div>}>

      <div style={{ fontSize: 13.5, color: C.stone, lineHeight: 1.5, marginBottom: 12 }}>
        {client.address || "No address on file"}
        {client.phone ? <><br />{client.phone}</> : null}
        {client.zone ? <><br /><span style={{ color: C.moss, fontWeight: 700 }}>{client.zone}</span></> : null}
      </div>

      <div style={{ display: "flex", gap: 10, background: "#fff", border: `1px solid ${C.line}`,
        borderRadius: 10, padding: 12, marginBottom: 12 }}>
        {stat("Rate", fmtMoney(client.rate))}
        {stat("Collected", fmtMoney(paid), C.forest)}
        {stat("Owed", fmtMoney(owed), owed > 0 ? C.alert : C.ink)}
      </div>

      {(avgMin || client.notes) && (
        <div style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 10, padding: 12, marginBottom: 12 }}>
          {avgMin && <div style={{ fontSize: 13 }}>
            Averages <b>{avgMin} min</b> on site across {timed.length} timed visit{timed.length > 1 ? "s" : ""}
            {client.rate > 0 && avgMin > 0 && <> — about <b>{fmtMoney(client.rate / (avgMin / 60))}/hr</b></>}
          </div>}
          {client.notes && <div style={{ fontSize: 13, color: C.stone, marginTop: avgMin ? 8 : 0, whiteSpace: "pre-wrap" }}>{client.notes}</div>}
        </div>
      )}

      <div style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: ".05em", textTransform: "uppercase",
        color: C.stone, margin: "4px 0 6px" }}>
        Service history — {visits.length} visit{visits.length !== 1 ? "s" : ""}
      </div>
      {visits.length === 0 && <div style={{ fontSize: 13, color: C.stone, fontStyle: "italic" }}>No visits logged yet.</div>}
      {visits.map(v => (
        <div key={v.id} onClick={() => onEditVisit(v)} style={{ background: "#fff", border: `1px solid ${C.line}`,
          borderRadius: 10, padding: "10px 12px", marginBottom: 5, display: "flex", alignItems: "center",
          gap: 10, cursor: "pointer" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 13.5 }}>{fmtDate(v.date)}
              {v.durationMin ? <span style={{ color: C.stone, fontWeight: 400 }}> · {v.durationMin} min</span> : null}
            </div>
            <div style={{ fontSize: 12, color: C.stone }}>{(v.servicesDone || []).join(", ") || "Service"}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontWeight: 800, fontSize: 14 }}>{fmtMoney(v.amount)}</div>
            <div style={{ fontSize: 11, fontWeight: 800, color: v.paid ? C.moss : C.alert }}>
              {v.paid ? "PAID" : "UNPAID"}
            </div>
          </div>
        </div>
      ))}
    </Sheet>
  );
}

// ─── LOG A PAST SERVICE (#5) ─────────────────────────────────────────────
export function AddServiceSheet({ data, upd, showToast, onClose, presetClientId }) {
  const [clientId, setClientId] = useState(presetClientId || (data.clients[0]?.id || ""));
  const [date, setDate] = useState(todayStr());
  const [amount, setAmount] = useState("");
  const [paid, setPaid] = useState(false);
  const [saving, setSaving] = useState(false);
  const client = data.clients.find(c => c.id === clientId);

  useEffect(() => { if (client && amount === "") setAmount(String(client.rate || "")); }, [clientId]);

  const save = () => {
    if (!clientId) { showToast("Pick a client", "err"); return; }
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt < 0) { showToast("Enter a valid amount", "err"); return; }
    if (saving) return;
    setSaving(true);
    upd(d => {
      if (d.visits.some(v => v.clientId === clientId && v.date === date)) return d;
      return { ...d, visits: [{ id: uid(), clientId, date, amount: amt,
        paid, paidDate: paid ? date : null, durationMin: null,
        servicesDone: ["Mow", "Trim", "Blow"] }, ...d.visits] };
    });
    showToast("Service logged"); onClose();
  };

  return (
    <Sheet title="Log a service" onClose={onClose} footer={
      <button onClick={save} style={{ width: "100%", background: C.forest, color: "#fff", border: "none",
        borderRadius: 10, padding: 13, fontWeight: 700, fontSize: 15, cursor: "pointer", fontFamily: "inherit" }}>Save</button>}>
      <div style={{ fontSize: 12, color: C.stone, marginBottom: 10 }}>
        For work you forgot to log, or did on an earlier day.
      </div>
      <div style={{ fontSize: 11.5, fontWeight: 800, color: C.stone, textTransform: "uppercase", marginBottom: 4 }}>Client</div>
      <select value={clientId} onChange={e => setClientId(e.target.value)} style={inputStyle}>
        {data.clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      <div style={{ height: 10 }} />
      <div style={{ display: "flex", gap: 8 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11.5, fontWeight: 800, color: C.stone, textTransform: "uppercase", marginBottom: 4 }}>Date</div>
          <input type="date" value={date} max={todayStr()} onChange={e => setDate(e.target.value)} style={inputStyle} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11.5, fontWeight: 800, color: C.stone, textTransform: "uppercase", marginBottom: 4 }}>Amount</div>
          <input type="number" value={amount} onChange={e => setAmount(e.target.value)} style={inputStyle} />
        </div>
      </div>
      <div style={{ height: 12 }} />
      <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", background: "#fff",
        border: `1px solid ${C.line}`, borderRadius: 10, padding: 12 }}>
        <input type="checkbox" checked={paid} onChange={e => setPaid(e.target.checked)} style={{ width: 20, height: 20 }} />
        <span style={{ fontWeight: 700, fontSize: 14.5 }}>Already paid on this date</span>
      </label>
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
