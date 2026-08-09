import { useState, useEffect } from "react";
import { todayStr, isoOf, mondayOf, weekDates, dowOf, fmtShort, fmtMoney, DAYS, DAYS_FULL, uid } from "./core.js";
import { VisitEditSheet, MessageSheet, AddServiceSheet } from "./Views4.jsx";

const C = { ink: "#0f1f13", forest: "#1B3A1F", moss: "#3f7a33", field: "#79bd56",
  paper: "#f7f3ed", card: "#ffffff", line: "#e2ddd2", stone: "#5c6a5e", alert: "#b3402e" };

// ─── TODAY ───────────────────────────────────────────────────────────────
export function TodayView({ data, upd, showToast }) {
  const [editVisit, setEditVisit] = useState(null);
  const [msgTarget, setMsgTarget] = useState(null); // {client, visit}
  // Job timer: {clientId, startedAt}. Kept in component state deliberately —
  // a half-finished timer is not business data and shouldn't outlive the app.
  const [addService, setAddService] = useState(false);
  const [timer, setTimer] = useState(null);
  const [tick, setTick] = useState(0);
  // Only run an interval while something is actually being timed. An
  // unconditional 1s interval re-renders the whole screen forever and wipes
  // any local state the child sheets are holding.
  useEffect(() => {
    if (!timer) return;
    const h = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(h);
  }, [timer]);
  const elapsedMin = timer ? Math.max(0, Math.round((Date.now() - timer.startedAt) / 60000)) : 0;
  const elapsedLabel = () => {
    if (!timer) return "";
    const s = Math.max(0, Math.floor((Date.now() - timer.startedAt) / 1000));
    return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  };
  const todayDow = new Date().getDay();
  const activeClients = data.clients.filter(c => c.status !== "inactive");
  // Today is driven by the WEEK PLAN, not by guessing from scheduleDays. The
  // old rule showed every dayless client on every single day, which made
  // "today's list" meaningless once most clients had no day set.
  const todayStops = (data.plannedStops || []).filter(s => s.date === todayStr());
  const todayClients = todayStops
    .map(s => activeClients.find(c => c.id === s.clientId))
    .filter(Boolean);

  // If today was never planned, offer one tap to plan it rather than showing
  // an empty screen with no way forward.
  const planToday = () => {
    upd(d => {
      const have = new Set((d.plannedStops || []).filter(s => s.date === todayStr()).map(s => s.clientId));
      const add = d.clients.filter(c => c.status !== "inactive")
        .filter(c => {
          const days = c.scheduleDays || [];
          return days.length ? days.includes(todayDow) : true;
        })
        .filter(c => !have.has(c.id))
        .map((c, i) => ({ id: uid(), clientId: c.id, date: todayStr(), order: i, done: false }));
      if (!add.length) { showToast("Nothing to add for today", "err"); return d; }
      showToast(`${add.length} stop${add.length > 1 ? "s" : ""} planned for today`);
      return { ...d, plannedStops: [...(d.plannedStops || []), ...add] };
    });
  };

  const markDone = (clientId, amount, durationMin = null) => {
    upd(d => {
      // Double-tap guard: a second tap before re-render would log the same
      // job twice and inflate both outstanding and income.
      if (d.visits.some(v => v.clientId === clientId && v.date === todayStr())) return d;
      return { ...d,
        visits: [{ id: uid(), clientId, date: todayStr(), amount, paid: false, paidDate: null,
          durationMin, servicesDone: ["Mow", "Trim", "Blow"] }, ...d.visits] };
    });
    showToast(durationMin ? `Logged — ${durationMin} min on site` : "Logged — collect payment to count it as income");
  };

  const stopTimerAndLog = c => {
    const mins = Math.max(1, elapsedMin);
    markDone(c.id, c.rate, mins);
    setTimer(null);
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

      <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "4px 0 8px" }}>
        <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", color: C.stone }}>
          {DAYS_FULL[todayDow]} — {todayClients.length} stop{todayClients.length !== 1 ? "s" : ""}
        </span>
        <div style={{ flex: 1 }} />
        {data.clients.length > 0 && <button onClick={() => setAddService(true)}
          style={{ fontSize: 11.5, fontWeight: 800, color: C.forest, background: "#fff",
            border: `1px solid ${C.line}`, borderRadius: 14, padding: "5px 11px", cursor: "pointer", fontFamily: "inherit" }}>
          + Log a service
        </button>}
      </div>

      {todayClients.length === 0 && (
        <div style={{ padding: 24, textAlign: "center", color: C.stone, background: "#fff", borderRadius: 12, border: `1px dashed ${C.line}` }}>
          {activeClients.length === 0
            ? "No clients yet. Add one from the Clients tab, or accept a Quote to create one."
            : <>
                <div style={{ marginBottom: 12 }}>Nothing planned for today.</div>
                <button onClick={planToday} style={{ background: C.forest, color: "#fff", border: "none",
                  borderRadius: 10, padding: "11px 18px", fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>
                  Plan today
                </button>
                <div style={{ fontSize: 12, marginTop: 10 }}>Or build the whole week from the Week tab.</div>
              </>}
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
            {!doneToday && (timer?.clientId === c.id
              ? <button onClick={() => stopTimerAndLog(c)} style={{ background: C.alert || "#b3402e", color: "#fff",
                  border: "none", borderRadius: 8, padding: "9px 12px", fontWeight: 700, fontSize: 13,
                  cursor: "pointer", fontFamily: "inherit", marginRight: 6 }}>
                  Stop {elapsedLabel()}
                </button>
              : !timer && <button onClick={() => { setTimer({ clientId: c.id, startedAt: Date.now() }); setTick(0); }}
                  style={{ background: "#fff", color: C.forest, border: `1px solid ${C.line}`, borderRadius: 8,
                    padding: "9px 12px", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit", marginRight: 6 }}>
                  Start
                </button>)}
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

      {addService && <AddServiceSheet data={data} upd={upd} showToast={showToast} onClose={() => setAddService(false)} />}
      {editVisit && <VisitEditSheet visit={editVisit} clientName={nameOf(editVisit.clientId)}
        upd={upd} showToast={showToast} onClose={() => setEditVisit(null)} />}
      {msgTarget && <MessageSheet client={msgTarget.client} visit={msgTarget.visit}
        business={data.business} showToast={showToast} onClose={() => setMsgTarget(null)} />}
    </div>
  );
}

// ─── WEEK PLANNER (differentiator: auto-fill + zone routing) ─────────────
// Sort by explicit order when set, falling back to zone grouping so a freshly
// auto-filled day still comes out as a sensible route before any manual moves.
const byOrder = data => (a, b) => {
  const ao = Number.isFinite(a.order) ? a.order : 999;
  const bo = Number.isFinite(b.order) ? b.order : 999;
  if (ao !== bo) return ao - bo;
  const cz = id => (data.clients.find(c => c.id === id)?.zone || "~");
  return cz(a.clientId).localeCompare(cz(b.clientId));
};

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

  // A planned stop is "done" only when a real visit exists for that client and
  // date. The old checkbox set a flag that logged no work and no income —
  // two identical-looking buttons where one silently lost money.
  const isStopDone = s => data.visits.some(v => v.clientId === s.clientId && v.date === s.date);

  // Reorder within a day. Stops carry an explicit `order`; zone is only the
  // tiebreaker, so once the operator sets an order it sticks and isn't
  // re-sorted out from under them on the next render.
  const moveStop = (date, stopId, dir) => {
    upd(d => {
      const day = (d.plannedStops || []).filter(s => s.date === date).sort(byOrder(d));
      const i = day.findIndex(s => s.id === stopId);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= day.length) return d;
      [day[i], day[j]] = [day[j], day[i]];
      const orderMap = new Map(day.map((s, idx) => [s.id, idx]));
      return { ...d, plannedStops: d.plannedStops.map(s =>
        orderMap.has(s.id) ? { ...s, order: orderMap.get(s.id) } : s) };
    });
  };

  // Google Maps multi-stop route: first address is the origin, last is the
  // destination, everything between becomes a waypoint in the given order.
  const mapsUrlFor = date => {
    const addrs = weekStops.filter(s => s.date === date && !isStopDone(s))
      .sort(byOrder(data))
      .map(s => (cById(s.clientId)?.address || "").trim())
      .filter(Boolean);
    if (!addrs.length) return null;
    const enc = a => encodeURIComponent(a);
    if (addrs.length === 1) return `https://www.google.com/maps/dir/?api=1&destination=${enc(addrs[0])}`;
    const dest = addrs[addrs.length - 1];
    const way = addrs.slice(0, -1);
    return `https://www.google.com/maps/dir/?api=1&destination=${enc(dest)}&waypoints=${way.map(enc).join("%7C")}`;
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
        background: "#fff", border: `1px solid ${C.line}`, borderRadius: 12, padding: "8px 10px", marginBottom: 10 }}>
        <button onClick={() => setWeekOffset(o => o - 1)} style={{ background: "none", border: "none", cursor: "pointer", padding: 6 }}>◂</button>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontWeight: 800, color: C.forest }}>{weekOffset === 0 ? "This week" : weekOffset === 1 ? "Next week" : `${fmtShort(dates[0])}–${fmtShort(dates[6])}`}</div>
          <div style={{ fontSize: 11, color: C.stone }}>{fmtShort(dates[0])} – {fmtShort(dates[6])} · {weekStops.filter(isStopDone).length}/{weekStops.length} done</div>
        </div>
        <button onClick={() => setWeekOffset(o => o + 1)} style={{ background: "none", border: "none", cursor: "pointer", padding: 6 }}>▸</button>
      </div>

      <button onClick={buildWeek} style={{ width: "100%", background: C.forest, color: "#fff", border: "none",
        borderRadius: 10, padding: 12, fontWeight: 700, fontSize: 14, marginBottom: 12, cursor: "pointer" }}>
        ⚡ Auto-fill week from recurring clients
      </button>

      {dates.map(date => {
        const dayStops = weekStops.filter(s => s.date === date).sort(byOrder(data));
        const mapsUrl = mapsUrlFor(date);
        const isToday = date === todayStr();
        return (
          <div key={date} style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 2px" }}>
              <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase",
                color: isToday ? C.forest : C.stone }}>
                {DAYS_FULL[dowOf(date)]} · {fmtShort(date)}{isToday && " — TODAY"}
              </span>
              <div style={{ flex: 1 }} />
              {mapsUrl && <a href={mapsUrl} target="_blank" rel="noreferrer"
                style={{ fontSize: 11.5, fontWeight: 800, color: C.moss, textDecoration: "none",
                  border: `1px solid ${C.line}`, borderRadius: 14, padding: "4px 10px", background: "#fff" }}>
                Route ↗
              </a>}
            </div>
            {dayStops.length === 0
              ? <div style={{ fontSize: 12, color: "#999", fontStyle: "italic", paddingLeft: 4 }}>—</div>
              : dayStops.map(s => {
                  const c = cById(s.clientId); if (!c) return null;
                  const done = isStopDone(s);
                  return (
                    <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 10, background: "#fff",
                      border: `1px solid ${C.line}`, borderRadius: 10, padding: "9px 11px", marginBottom: 5, opacity: done ? 0.55 : 1 }}>
                      <span title={done ? "Logged on the Today tab" : "Not logged yet"}
                        style={{ width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
                          border: `2px solid ${done ? C.forest : C.line}`, background: done ? C.forest : "#fff",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          color: "#fff", fontSize: 12, fontWeight: 900 }}>{done ? "✓" : ""}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 14, textDecoration: done ? "line-through" : "none" }}>{c.name}</div>
                        <div style={{ fontSize: 12, color: C.stone }}>
                          {c.zone && <span style={{ color: C.moss, fontWeight: 700 }}>{c.zone} · </span>}{c.address}
                        </div>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                        <button aria-label="Move up" onClick={() => moveStop(date, s.id, -1)}
                          style={{ border: `1px solid ${C.line}`, background: "#fff", borderRadius: 6,
                            width: 30, height: 22, cursor: "pointer", fontSize: 11, lineHeight: 1, padding: 0, fontFamily: "inherit" }}>▲</button>
                        <button aria-label="Move down" onClick={() => moveStop(date, s.id, 1)}
                          style={{ border: `1px solid ${C.line}`, background: "#fff", borderRadius: 6,
                            width: 30, height: 22, cursor: "pointer", fontSize: 11, lineHeight: 1, padding: 0, fontFamily: "inherit" }}>▼</button>
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
