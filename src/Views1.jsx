import { useState } from "react";
import { todayStr, isoOf, mondayOf, weekDates, dowOf, fmtShort, fmtMoney, DAYS, DAYS_FULL, uid } from "./core.js";
import { VisitEditSheet, MessageSheet } from "./Views4.jsx";

const C = { ink: "#0f1f13", forest: "#1B3A1F", moss: "#3f7a33", field: "#79bd56",
  paper: "#f7f3ed", card: "#ffffff", line: "#e2ddd2", stone: "#5c6a5e" };

// ─── TODAY ───────────────────────────────────────────────────────────────
export function TodayView({ data, upd, showToast }) {
  const [editVisit, setEditVisit] = useState(null);
  const [msgTarget, setMsgTarget] = useState(null); // {client, visit}
  const todayDow = new Date().getDay();
  const activeClients = data.clients.filter(c => c.status !== "inactive");
  // A client with no fixed schedule day is "floating" — shows every day so
  // it's never invisible just because a day was never assigned.
  const todayClients = activeClients.filter(c =>
    (c.scheduleDays || []).length === 0 || (c.scheduleDays || []).includes(todayDow));

  const markDone = (clientId, amount) => {
    upd(d => {
      // Double-tap guard: a second tap before re-render would log the same
      // job twice and inflate both outstanding and income.
      if (d.visits.some(v => v.clientId === clientId && v.date === todayStr())) return d;
      return { ...d,
        visits: [{ id: uid(), clientId, date: todayStr(), amount, paid: false, paidDate: null,
          durationMin: null, servicesDone: ["Mow", "Trim", "Blow"] }, ...d.visits] };
    });
    showToast("Logged — collect payment to count it as income");
  };

  // CASH-BASIS: marking paid stamps TODAY as the paidDate. That date — not the
  // service date — is what every income figure in the app is computed from.
  const markPaid = visitId => {
    upd(d => ({ ...d, visits: d.visits.map(v => (v.id === visitId && !v.paid)
      ? { ...v, paid: true, paidDate: todayStr() } : v) }));
    showToast("Payment collected — counted as income today");
  };

  const unpaidVisits = data.visits.filter(v => !v.paid);
  const monthTotal = data.visits.filter(v => v.paid && v.paidDate?.slice(0, 7) === todayStr().slice(0, 7))
    .reduce((s, v) => s + Number(v.amount || 0), 0);
  const outstanding = unpaidVisits.reduce((s, v) => s + Number(v.amount || 0), 0);
  const nameOf = id => data.clients.find(c => c.id === id)?.name || "Unknown";

  return (
    <div>
      <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
        <div style={{ flex: 1, background: "#fff", border: `1px solid ${C.line}`, borderRadius: 12, padding: 12 }}>
          <div style={{ fontSize: 11, color: C.stone, fontWeight: 700, textTransform: "uppercase" }}>Collected this month</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: C.forest }}>{fmtMoney(monthTotal)}</div>
        </div>
        <div style={{ flex: 1, background: "#fff", border: `1px solid ${C.line}`, borderRadius: 12, padding: 12 }}>
          <div style={{ fontSize: 11, color: C.stone, fontWeight: 700, textTransform: "uppercase" }}>Outstanding</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: outstanding > 0 ? "#b3402e" : C.forest }}>{fmtMoney(outstanding)}</div>
        </div>
      </div>

      <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", color: C.stone, margin: "4px 0 8px" }}>
        {DAYS_FULL[todayDow]} — {todayClients.length} stop{todayClients.length !== 1 ? "s" : ""}
      </div>

      {todayClients.length === 0 && (
        <div style={{ padding: 30, textAlign: "center", color: C.stone, background: "#fff", borderRadius: 12, border: `1px dashed ${C.line}` }}>
          No clients yet. Add one from the Clients tab, or accept a Quote to auto-create one.
        </div>
      )}

      {todayClients.map(c => {
        const doneToday = data.visits.some(v => v.clientId === c.id && v.date === todayStr());
        return (
          <div key={c.id} style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 12,
            padding: 13, marginBottom: 8, display: "flex", alignItems: "center", gap: 12, opacity: doneToday ? 0.55 : 1 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{c.name}</div>
              <div style={{ fontSize: 12.5, color: C.stone, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {c.zone && <span style={{ color: C.moss, fontWeight: 700 }}>{c.zone} · </span>}
                {c.address || "No address"} · {fmtMoney(c.rate)}
              </div>
            </div>
            {doneToday
              ? <button onClick={() => { const lv = data.visits.filter(x => x.clientId === c.id).sort((a,b)=>(b.date||"").localeCompare(a.date||""))[0]; setMsgTarget({ client: c, visit: lv || null }); }}
                  style={{ background: C.moss, color: "#fff", border: "none", borderRadius: 8, padding: "9px 14px",
                    fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
                  Text receipt
                </button>
              : <button onClick={() => markDone(c.id, c.rate)} style={{ background: C.forest, color: "#fff",
                  border: "none", borderRadius: 8, padding: "9px 14px", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
                  Mark Done
                </button>}
          </div>
        );
      })}

      {unpaidVisits.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase",
            color: "#b3402e", margin: "4px 0 8px" }}>
            Awaiting payment — {unpaidVisits.length} job{unpaidVisits.length !== 1 ? "s" : ""}
          </div>
          <div style={{ fontSize: 12, color: C.stone, marginBottom: 8 }}>
            Nothing counts as income until it's collected. Tap Collect the day the money actually arrives.
          </div>
          {unpaidVisits.map(v => (
            <div key={v.id} style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 12,
              padding: 12, marginBottom: 6 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ flex: 1, minWidth: 0, cursor: "pointer" }} onClick={() => setEditVisit(v)}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{nameOf(v.clientId)}</div>
                  <div style={{ fontSize: 12, color: C.stone }}>Serviced {v.date} · {fmtMoney(v.amount)} · tap to edit</div>
                </div>
                <button onClick={() => markPaid(v.id)} style={{ background: "#3f7a33", color: "#fff",
                  border: "none", borderRadius: 8, padding: "9px 14px", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
                  Collect
                </button>
              </div>
              <button onClick={() => { const c = data.clients.find(x => x.id === v.clientId); if (c) setMsgTarget({ client: c, visit: v }); }}
                style={{ width: "100%", marginTop: 8, background: "#fff", color: C.forest, border: `1px solid ${C.line}`,
                  borderRadius: 8, padding: "8px 0", fontWeight: 700, fontSize: 12.5, cursor: "pointer", fontFamily: "inherit" }}>
                Send payment reminder
              </button>
            </div>
          ))}
        </div>
      )}

      {editVisit && <VisitEditSheet visit={editVisit} clientName={nameOf(editVisit.clientId)}
        upd={upd} showToast={showToast} onClose={() => setEditVisit(null)} />}
      {msgTarget && <MessageSheet client={msgTarget.client} visit={msgTarget.visit}
        business={data.business} showToast={showToast} onClose={() => setMsgTarget(null)} />}
    </div>
  );
}

// ─── WEEK PLANNER (differentiator: auto-fill + zone routing) ─────────────
export function WeekView({ data, upd, showToast }) {
  const [weekOffset, setWeekOffset] = useState(1);
  const mon = mondayOf(weekOffset);
  const dates = weekDates(mon);
  const planned = data.plannedStops || [];
  const weekStops = planned.filter(s => dates.includes(s.date));

  const cById = id => data.clients.find(c => c.id === id);

  const buildWeek = () => {
    upd(d => {
      const have = new Set((d.plannedStops || []).map(s => s.clientId + "|" + s.date));
      const add = [];
      const floating = [];
      d.clients.filter(c => c.status !== "inactive").forEach(c => {
        const days = c.scheduleDays || [];
        if (!days.length) { floating.push(c); return; }
        days.forEach(dow => {
          const date = dates.find(dt => dowOf(dt) === dow);
          if (date && !have.has(c.id + "|" + date)) {
            add.push({ id: uid(), clientId: c.id, date, done: false });
            have.add(c.id + "|" + date);
          }
        });
      });
      // Floating clients (no fixed day) get dealt round-robin across Mon-Fri
      // so a "no day set" client still gets a workable weekly slot.
      floating.forEach((c, idx) => {
        const date = dates[idx % 5];
        if (!have.has(c.id + "|" + date)) {
          add.push({ id: uid(), clientId: c.id, date, done: false });
          have.add(c.id + "|" + date);
        }
      });
      if (!add.length) { showToast("Week already built", "err"); return d; }
      showToast(`${add.length} stop${add.length > 1 ? "s" : ""} added`);
      return { ...d, plannedStops: [...(d.plannedStops || []), ...add] };
    });
  };

  const toggleDone = id => upd(d => ({ ...d, plannedStops: d.plannedStops.map(s => s.id === id ? { ...s, done: !s.done } : s) }));

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
        background: "#fff", border: `1px solid ${C.line}`, borderRadius: 12, padding: "8px 10px", marginBottom: 10 }}>
        <button onClick={() => setWeekOffset(o => o - 1)} style={{ background: "none", border: "none", cursor: "pointer", padding: 6 }}>◂</button>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontWeight: 800, color: C.forest }}>{weekOffset === 0 ? "This week" : weekOffset === 1 ? "Next week" : `${fmtShort(dates[0])}–${fmtShort(dates[6])}`}</div>
          <div style={{ fontSize: 11, color: C.stone }}>{fmtShort(dates[0])} – {fmtShort(dates[6])} · {weekStops.filter(s => s.done).length}/{weekStops.length} done</div>
        </div>
        <button onClick={() => setWeekOffset(o => o + 1)} style={{ background: "none", border: "none", cursor: "pointer", padding: 6 }}>▸</button>
      </div>

      <button onClick={buildWeek} style={{ width: "100%", background: C.forest, color: "#fff", border: "none",
        borderRadius: 10, padding: 12, fontWeight: 700, fontSize: 14, marginBottom: 12, cursor: "pointer" }}>
        ⚡ Auto-fill week from recurring clients
      </button>

      {dates.map(date => {
        const dayStops = weekStops.filter(s => s.date === date)
          .sort((a, b) => { const za = cById(a.clientId)?.zone || "~", zb = cById(b.clientId)?.zone || "~"; return za.localeCompare(zb); });
        const isToday = date === todayStr();
        return (
          <div key={date} style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase",
              color: isToday ? C.forest : C.stone, padding: "4px 2px" }}>
              {DAYS_FULL[dowOf(date)]} · {fmtShort(date)}{isToday && " — TODAY"}
            </div>
            {dayStops.length === 0
              ? <div style={{ fontSize: 12, color: "#999", fontStyle: "italic", paddingLeft: 4 }}>—</div>
              : dayStops.map(s => {
                  const c = cById(s.clientId); if (!c) return null;
                  return (
                    <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 10, background: "#fff",
                      border: `1px solid ${C.line}`, borderRadius: 10, padding: "9px 11px", marginBottom: 5, opacity: s.done ? 0.55 : 1 }}>
                      <button onClick={() => toggleDone(s.id)} style={{ width: 22, height: 22, borderRadius: "50%",
                        border: `2px solid ${s.done ? C.forest : C.line}`, background: s.done ? C.forest : "#fff",
                        cursor: "pointer", flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 14, textDecoration: s.done ? "line-through" : "none" }}>{c.name}</div>
                        <div style={{ fontSize: 12, color: C.stone }}>
                          {c.zone && <span style={{ color: C.moss, fontWeight: 700 }}>{c.zone} · </span>}{c.address}
                        </div>
                      </div>
                    </div>
                  );
                })}
          </div>
        );
      })}
    </div>
  );
}
