import { useState } from "react";
import { fmtMoney, uid, priceQuote, marginCheck, DAYS } from "./core.js";
import { ClientEditSheet, MessageSheet, ClientDetailSheet, VisitEditSheet } from "./Views4.jsx";

const C = { ink: "#0f1f13", forest: "#1B3A1F", moss: "#3f7a33", field: "#79bd56",
  paper: "#f7f3ed", card: "#ffffff", line: "#e2ddd2", stone: "#5c6a5e",
  alert: "#b3402e", alertBg: "#fbeeea", okBg: "#eef6e9" };

const inputStyle = { width: "100%", padding: "11px 12px", fontSize: 15, border: `1px solid ${C.line}`,
  borderRadius: 8, fontFamily: "inherit", boxSizing: "border-box" };

// ─── CLIENTS ────────────────────────────────────────────────────────────
const BLANK_CLIENT = () => ({ id: uid(), status: "active", name: "", address: "", phone: "",
  rate: "", zone: "", frequency: "weekly", weekParity: 0, scheduleDays: [], notes: "" });

export function ClientsView({ data, upd, showToast }) {
  const [adding, setAdding] = useState(null);       // blank client for the new-client sheet
  const [editing, setEditing] = useState(null);     // client being edited
  const [detail, setDetail] = useState(null);       // client detail view
  const [messaging, setMessaging] = useState(null); // client being texted
  const [editVisit, setEditVisit] = useState(null); // visit opened from detail
  const [form, setForm] = useState({ name: "", address: "", phone: "", rate: "", zone: "", scheduleDays: [] });

  const addClient = () => {
    if (!form.name.trim()) { showToast("Name required", "err"); return; }
    const nm = form.name.trim();
    upd(d => d.clients.some(c => c.name.toLowerCase() === nm.toLowerCase())
      ? d  // double-tap guard: same name already added
      : ({ ...d, clients: [{ id: uid(), status: "active", ...form, name: nm, rate: Number(form.rate) || 0 }, ...d.clients] }));
    setForm({ name: "", address: "", phone: "", rate: "", zone: "", scheduleDays: [] });
    setAdding(false);
    showToast("Client added");
  };

  const toggleDay = i => setForm(f => ({ ...f, scheduleDays: f.scheduleDays.includes(i) ? f.scheduleDays.filter(x => x !== i) : [...f.scheduleDays, i] }));

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ fontFamily: "Georgia,serif", fontSize: 20, fontWeight: 700 }}>Clients</div>
        <button onClick={() => setAdding(BLANK_CLIENT())} style={{ background: C.forest, color: "#fff", border: "none",
          borderRadius: 8, padding: "8px 14px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>+ Add</button>
      </div>

      {data.clients.length === 0 && (
        <div style={{ padding: 30, textAlign: "center", color: C.stone, background: "#fff", borderRadius: 12, border: `1px dashed ${C.line}` }}>
          No clients yet.
        </div>
      )}

      {data.clients.map(c => {
        const totalEarned = data.visits.filter(v => v.clientId === c.id && v.paid).reduce((s, v) => s + Number(v.amount || 0), 0);
        return (
          <div key={c.id} style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 12, padding: 13, marginBottom: 8 }}>
            <div onClick={() => setDetail(c)} style={{ cursor: "pointer" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <div style={{ fontWeight: 700 }}>{c.name}</div>
                <div style={{ fontWeight: 700, color: C.forest }}>{fmtMoney(c.rate)}/visit</div>
              </div>
              <div style={{ fontSize: 12.5, color: C.stone, marginTop: 2 }}>
                {c.zone && <span style={{ color: C.moss, fontWeight: 700 }}>{c.zone} · </span>}
                {c.address} · Lifetime: {fmtMoney(totalEarned)}
              </div>
            </div>
            <div style={{ display: "flex", gap: 7, marginTop: 10 }}>
              <button onClick={() => setDetail(c)} style={{ flex: 1, background: "#fff", color: C.forest,
                border: `1px solid ${C.line}`, borderRadius: 8, padding: "8px 0", fontWeight: 700, fontSize: 12.5,
                cursor: "pointer", fontFamily: "inherit" }}>Details</button>
              <button onClick={() => setMessaging(c)} style={{ flex: 1, background: C.moss, color: "#fff",
                border: "none", borderRadius: 8, padding: "8px 0", fontWeight: 700, fontSize: 12.5,
                cursor: "pointer", fontFamily: "inherit" }}>Text</button>
              {c.phone && <a href={`tel:${String(c.phone).replace(/\D/g,"")}`} style={{ flex: 1, textAlign: "center",
                background: "#fff", color: C.forest, border: `1px solid ${C.line}`, borderRadius: 8, padding: "8px 0",
                fontWeight: 700, fontSize: 12.5, textDecoration: "none" }}>Call</a>}
            </div>
          </div>
        );
      })}

      {adding && <ClientEditSheet client={adding} isNew upd={upd} showToast={showToast} onClose={() => setAdding(null)} />}
      {editing && <ClientEditSheet client={editing} upd={upd} showToast={showToast} onClose={() => setEditing(null)} />}
      {detail && <ClientDetailSheet client={data.clients.find(c => c.id === detail.id) || detail} data={data}
        onClose={() => setDetail(null)}
        onEdit={() => { const c = detail; setDetail(null); setEditing(c); }}
        onText={() => { const c = detail; setDetail(null); setMessaging(c); }}
        onEditVisit={v => { setDetail(null); setEditVisit(v); }} />}
      {editVisit && <VisitEditSheet visit={editVisit}
        clientName={data.clients.find(c => c.id === editVisit.clientId)?.name || ""}
        upd={upd} showToast={showToast} onClose={() => setEditVisit(null)} />}
      {messaging && <MessageSheet client={messaging}
        visit={data.visits.filter(v => v.clientId === messaging.id).sort((a,b) => (b.date||"").localeCompare(a.date||""))[0] || null}
        business={data.business} showToast={showToast} onClose={() => setMessaging(null)} />}
    </div>
  );
}

// ─── QUOTE + PRICING ENGINE (flagship differentiator) ─────────────────────
export function QuoteView({ data, upd, showToast }) {
  const [lotSqFt, setLotSqFt] = useState(8000);
  const [obstacles, setObstacles] = useState(1);
  const [roundTripMiles, setRoundTripMiles] = useState(6);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const est = priceQuote(lotSqFt, obstacles, data.pricing);
  const margin = marginCheck(est, data.business.targetHourlyNet, 0.30, roundTripMiles);

  // CALIBRATION: what the timer actually recorded, versus what this engine
  // assumes. Estimates drift from reality; this closes the loop with real data
  // instead of leaving the operator to guess whether their rate is right.
  const timed = data.visits.filter(v => Number(v.durationMin) > 0 && Number(v.amount) > 0);
  const realHourly = timed.length
    ? timed.reduce((s, v) => s + Number(v.amount) / (Number(v.durationMin) / 60), 0) / timed.length
    : null;
  const avgMin = timed.length
    ? Math.round(timed.reduce((s, v) => s + Number(v.durationMin), 0) / timed.length)
    : null;

  const acceptQuote = () => {
    if (!name.trim()) { showToast("Client name required", "err"); return; }
    // Guard against double-tap: on mobile a fast second tap fires before the
    // re-render clears the field, silently creating a duplicate client.
    if (submitting) return;
    setSubmitting(true);
    const clientId = uid();
    const trimmed = name.trim();
    upd(d => {
      if (d.clients.some(c => c.name.toLowerCase() === trimmed.toLowerCase() && c.rate === est.price)) {
        return d; // already created by the first tap
      }
      // Quotes were being written to an array nothing ever read. The accepted
      // quote's real output is the client record and its rate — that's what
      // gets stored; lotSqFt is kept so the estimate can be recreated.
      return {
        ...d,
        clients: [{ id: clientId, status: "active", name: trimmed, address, phone: "", rate: est.price,
          zone: "", scheduleDays: [], lotSqFt, notes: "" }, ...d.clients],
      };
    });
    setName(""); setAddress("");
    showToast(`${trimmed} added as a client at ${fmtMoney(est.price)}/visit`);
    setTimeout(() => setSubmitting(false), 400);
  };

  return (
    <div>
      <div style={{ fontFamily: "Georgia,serif", fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Instant Quote</div>
      <div style={{ fontSize: 12.5, color: C.stone, marginBottom: 14 }}>
        Lot size → time estimate → price, with a live margin check so a quote never accidentally loses money.
      </div>

      <div style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 12, padding: 14, marginBottom: 12 }}>
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 11.5, fontWeight: 800, color: C.stone, textTransform: "uppercase" }}>Lot size (sq ft) — {lotSqFt.toLocaleString()}</label>
          <input type="range" min="1000" max="43560" step="500" value={lotSqFt} onChange={e => setLotSqFt(Number(e.target.value))} style={{ width: "100%" }} />
        </div>
        <div style={{ marginBottom: 8 }}>
          <label style={{ fontSize: 11.5, fontWeight: 800, color: C.stone, textTransform: "uppercase" }}>Obstacles</label>
          <div style={{ display: "flex", gap: 6, marginTop: 5 }}>
            {[[0, "Open lawn"], [1, "Some trees/beds"], [2, "Heavy"]].map(([v, l]) => (
              <button key={v} onClick={() => setObstacles(v)} style={{
                flex: 1, padding: "9px 6px", borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: "pointer",
                border: `1px solid ${obstacles === v ? C.forest : C.line}`,
                background: obstacles === v ? C.forest : "#fff", color: obstacles === v ? "#fff" : C.stone }}>{l}</button>
            ))}
          </div>
        </div>
        <div>
          <label style={{ fontSize: 11.5, fontWeight: 800, color: C.stone, textTransform: "uppercase" }}>Round-trip drive miles — {roundTripMiles}</label>
          <input type="range" min="0" max="40" value={roundTripMiles} onChange={e => setRoundTripMiles(Number(e.target.value))} style={{ width: "100%" }} />
        </div>
      </div>

      <div style={{ background: C.forest, color: "#fff", borderRadius: 12, padding: 16, marginBottom: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <div style={{ fontSize: 13, opacity: 0.8 }}>Quoted price</div>
          <div style={{ fontSize: 30, fontWeight: 800 }}>{fmtMoney(est.price)}</div>
        </div>
        <div style={{ fontSize: 12.5, opacity: 0.85, marginTop: 4 }}>
          {est.totalMin} min total · mow {est.mowMin}m, trim {est.trimMin}m, blow {est.blowMin}m, setup {est.setupMin}m
        </div>
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid rgba(255,255,255,.2)", display: "flex", justifyContent: "space-between" }}>
          <span style={{ fontSize: 12.5, opacity: 0.85 }}>Net $/hr after drive cost</span>
          <span style={{ fontWeight: 800, color: margin.meetsTarget ? "#9fe08a" : "#ffb199" }}>{fmtMoney(margin.netPerHour)}/hr</span>
        </div>
      </div>

      {!margin.meetsTarget && (
        <div style={{ background: C.alertBg, border: `1px solid ${C.alert}`, borderRadius: 10, padding: 11, marginBottom: 12, fontSize: 13 }}>
          <b style={{ color: C.alert }}>Below your ${data.business.targetHourlyNet}/hr target</b> by {fmtMoney(margin.shortfall)}/hr — drive distance or obstacle time is eating the margin. Consider raising the rate or grouping this stop with a nearby job.
        </div>
      )}

      {timed.length > 0 && (
        <div style={{ background: C.okBg, border: `1px solid ${C.moss}`, borderRadius: 12, padding: 13, marginBottom: 12 }}>
          <div style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: ".06em", textTransform: "uppercase",
            color: C.moss, marginBottom: 5 }}>
            Reality check — from {timed.length} timed job{timed.length > 1 ? "s" : ""}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5 }}>
            <span>Actual average on site</span><b>{avgMin} min</b>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5, marginTop: 3 }}>
            <span>Actual earned per hour</span><b>{fmtMoney(realHourly)}/hr</b>
          </div>
          <div style={{ fontSize: 11.5, color: C.stone, marginTop: 7, lineHeight: 1.45 }}>
            {realHourly >= data.pricing.billableRate
              ? `You're clearing more than your ${fmtMoney(data.pricing.billableRate)}/hr target on timed work — the engine is pricing conservatively.`
              : `You're earning less than your ${fmtMoney(data.pricing.billableRate)}/hr target. Either jobs take longer than estimated, or the rate needs to come up.`}
          </div>
        </div>
      )}

      <div style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 12, padding: 14 }}>
        <input style={inputStyle} placeholder="Client name" value={name} onChange={e => setName(e.target.value)} />
        <div style={{ height: 8 }} />
        <input style={inputStyle} placeholder="Address" value={address} onChange={e => setAddress(e.target.value)} />
        <button onClick={acceptQuote} style={{ marginTop: 10, width: "100%", background: C.moss, color: "#fff",
          border: "none", borderRadius: 8, padding: 12, fontWeight: 700, fontSize: 14.5, cursor: "pointer" }}>
          Accept Quote → Create Client
        </button>
        <div style={{ fontSize: 11.5, color: C.stone, marginTop: 6, textAlign: "center" }}>
          One tap creates the client record at this rate — no re-typing into a separate system.
        </div>
      </div>
    </div>
  );
}
