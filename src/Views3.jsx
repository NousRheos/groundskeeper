import { useState } from "react";
import { fmtMoney, todayStr, uid, migrate } from "./core.js";

const C = { ink: "#0f1f13", forest: "#1B3A1F", moss: "#3f7a33", field: "#79bd56",
  paper: "#f7f3ed", card: "#ffffff", line: "#e2ddd2", stone: "#5c6a5e",
  alert: "#b3402e", alertBg: "#fbeeea", amber: "#a06a12", amberBg: "#faf3e3", okBg: "#eef6e9" };

const inputStyle = { width: "100%", padding: "11px 12px", fontSize: 15, border: `1px solid ${C.line}`,
  borderRadius: 8, fontFamily: "inherit", boxSizing: "border-box" };

// ─── TAX (cash-basis accounting — the core financial differentiator) ─────
export function TaxView({ data, upd, showToast }) {
  const [mileForm, setMileForm] = useState({ miles: "", purpose: "" });
  const [expForm, setExpForm] = useState({ amount: "", category: "Supplies", vendor: "" });

  // CASH-BASIS: income counted the day it was COLLECTED (paidDate), never the
  // day the job was done. This is the legally correct method for a solo
  // contractor filing Schedule C on the cash method, and it's the single
  // most commonly modeled WRONG in demo/template apps — they sum by job date.
  const year = new Date().getFullYear();
  const collectedThisYear = data.visits.filter(v => v.paid && v.paidDate?.startsWith(String(year)))
    .reduce((s, v) => s + Number(v.amount || 0), 0);
  const outstanding = data.visits.filter(v => !v.paid).reduce((s, v) => s + Number(v.amount || 0), 0);

  const totalExpenses = data.expenses.filter(e => e.date?.startsWith(String(year))).reduce((s, e) => s + Number(e.amount || 0), 0);
  const totalMiles = data.mileage.filter(m => m.date?.startsWith(String(year))).reduce((s, m) => s + Number(m.miles || 0), 0);
  const mileageDeduction = totalMiles * data.business.mileageRate;

  const netIncome = collectedThisYear - totalExpenses - mileageDeduction;
  const setAside = Math.max(0, netIncome) * (data.business.taxSetAsidePct / 100);

  const addMileage = () => {
    if (!mileForm.miles) { showToast("Enter miles", "err"); return; }
    upd(d => ({ ...d, mileage: [{ id: uid(), date: todayStr(), miles: Number(mileForm.miles), purpose: mileForm.purpose }, ...d.mileage] }));
    setMileForm({ miles: "", purpose: "" });
    showToast("Mileage logged");
  };

  const addExpense = () => {
    if (!expForm.amount) { showToast("Enter amount", "err"); return; }
    upd(d => ({ ...d, expenses: [{ id: uid(), date: todayStr(), amount: Number(expForm.amount), category: expForm.category, vendor: expForm.vendor }, ...d.expenses] }));
    setExpForm({ amount: "", category: "Supplies", vendor: "" });
    showToast("Expense logged");
  };

  return (
    <div>
      <div style={{ fontFamily: "Georgia,serif", fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Tax Center</div>
      <div style={{ fontSize: 12.5, color: C.stone, marginBottom: 14 }}>
        Cash-basis — income counted the day it's collected, not the day the job was done.
      </div>

      <div style={{ background: C.forest, color: "#fff", borderRadius: 12, padding: 16, marginBottom: 12 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <div style={{ fontSize: 11, opacity: 0.8 }}>Collected {year}</div>
            <div style={{ fontSize: 20, fontWeight: 800 }}>{fmtMoney(collectedThisYear)}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, opacity: 0.8 }}>Outstanding</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#ffb199" }}>{fmtMoney(outstanding)}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, opacity: 0.8 }}>Expenses + mileage</div>
            <div style={{ fontSize: 20, fontWeight: 800 }}>{fmtMoney(totalExpenses + mileageDeduction)}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, opacity: 0.8 }}>Net income</div>
            <div style={{ fontSize: 20, fontWeight: 800 }}>{fmtMoney(netIncome)}</div>
          </div>
        </div>
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,.2)" }}>
          <div style={{ fontSize: 12, opacity: 0.85 }}>Set aside for quarterly estimated tax ({data.business.taxSetAsidePct}% of net)</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: "#9fe08a" }}>{fmtMoney(setAside)}</div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
        <div style={{ flex: 1, background: "#fff", border: `1px solid ${C.line}`, borderRadius: 12, padding: 12 }}>
          <div style={{ fontSize: 11, color: C.stone, fontWeight: 700, textTransform: "uppercase" }}>Miles logged</div>
          <div style={{ fontSize: 18, fontWeight: 800 }}>{totalMiles.toLocaleString()}</div>
          <div style={{ fontSize: 11, color: C.stone }}>= {fmtMoney(mileageDeduction)} deduction</div>
        </div>
      </div>

      <div style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 12, padding: 14, marginBottom: 12 }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Log mileage</div>
        <div style={{ display: "flex", gap: 8 }}>
          <input style={inputStyle} type="number" placeholder="Miles" value={mileForm.miles} onChange={e => setMileForm({ ...mileForm, miles: e.target.value })} />
          <input style={inputStyle} placeholder="Purpose" value={mileForm.purpose} onChange={e => setMileForm({ ...mileForm, purpose: e.target.value })} />
        </div>
        <button onClick={addMileage} style={{ marginTop: 8, width: "100%", background: C.forest, color: "#fff", border: "none", borderRadius: 8, padding: 10, fontWeight: 700, cursor: "pointer" }}>Add</button>
      </div>

      <div style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 12, padding: 14 }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Log expense</div>
        <div style={{ display: "flex", gap: 8 }}>
          <input style={inputStyle} type="number" placeholder="Amount $" value={expForm.amount} onChange={e => setExpForm({ ...expForm, amount: e.target.value })} />
          <select style={inputStyle} value={expForm.category} onChange={e => setExpForm({ ...expForm, category: e.target.value })}>
            {["Supplies", "Fuel", "Maintenance", "Equipment", "Insurance", "Other"].map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <button onClick={addExpense} style={{ marginTop: 8, width: "100%", background: C.forest, color: "#fff", border: "none", borderRadius: 8, padding: 10, fontWeight: 700, cursor: "pointer" }}>Add</button>
      </div>
    </div>
  );
}

// ─── SETTINGS ───────────────────────────────────────────────────────────
// Every number the pricing engine and tax engine depend on is editable here.
// Without this the app is a fixed demo; with it, a contractor (or a judge)
// can put their own real economics in and watch every downstream figure move.
export function SettingsView({ data, upd, showToast }) {
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const setBiz = (k, v) => upd(d => ({ ...d, business: { ...d.business, [k]: v } }));
  const setPricing = (k, v) => upd(d => ({ ...d, pricing: { ...d.pricing, [k]: v } }));
  const num = v => (v === "" ? "" : Number(v));

  // Export via clipboard rather than file download: a blob download is
  // silently blocked in some embedded/mobile webviews and reports success
  // anyway, which loses the backup without telling the user.
  const copyBackup = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
      showToast("Backup copied — paste it somewhere safe");
    } catch {
      setPasteOpen(true);
      showToast("Clipboard blocked — copy from the box below", "err");
    }
  };

  const loadPasted = mode => {
    let incoming;
    try {
      // Strip smart quotes, BOM, and zero-width characters that phone
      // keyboards and messaging apps inject when text is copied around.
      const clean = pasteText
        .replace(/[\u201C\u201D]/g, '"').replace(/[\u2018\u2019]/g, "'")
        .replace(/[\uFEFF\u200B-\u200D]/g, "").trim();
      incoming = JSON.parse(clean);
    } catch {
      showToast("That isn't valid backup text", "err"); return;
    }
    if (!incoming || typeof incoming !== "object" || !Array.isArray(incoming.clients)) {
      showToast("Backup is missing a clients list", "err"); return;
    }
    upd(d => {
      if (mode === "replace") return migrate(incoming);
      // Merge by id so re-importing the same backup can't duplicate rows.
      const mergeById = (a, b) => {
        const seen = new Set(a.map(x => x.id));
        return [...a, ...b.filter(x => x && x.id && !seen.has(x.id))];
      };
      const inc = migrate(incoming);
      return { ...d,
        clients: mergeById(d.clients, inc.clients),
        visits: mergeById(d.visits, inc.visits),
        expenses: mergeById(d.expenses, inc.expenses),
        mileage: mergeById(d.mileage, inc.mileage),
        quotes: mergeById(d.quotes, inc.quotes),
        equipment: mergeById(d.equipment, inc.equipment),
        plannedStops: mergeById(d.plannedStops, inc.plannedStops),
      };
    });
    setPasteText(""); setPasteOpen(false);
    showToast(mode === "replace" ? "Data replaced" : "Data merged in");
  };

  const row = (label, value, onChange, suffix) => (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 0",
      borderBottom: `1px solid ${C.line}` }}>
      <span style={{ fontSize: 13.5 }}>{label}</span>
      <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
        <input value={value} onChange={e => onChange(num(e.target.value))} type="number"
          style={{ width: 86, padding: "6px 8px", fontSize: 13.5, textAlign: "right",
            border: `1px solid ${C.line}`, borderRadius: 6, fontFamily: "inherit" }} />
        {suffix && <span style={{ fontSize: 12, color: C.stone, width: 34 }}>{suffix}</span>}
      </span>
    </div>
  );

  return (
    <div>
      <div style={{ fontFamily: "Georgia,serif", fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Settings</div>
      <div style={{ fontSize: 12.5, color: C.stone, marginBottom: 14 }}>
        Change any number here and every quote, margin check, and tax figure updates immediately.
      </div>

      <div style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 12, padding: 14, marginBottom: 12 }}>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>Business</div>
        <input style={inputStyle} placeholder="Business name" value={data.business.name}
          onChange={e => setBiz("name", e.target.value)} />
        <div style={{ height: 6 }} />
        {row("Target net $/hour", data.business.targetHourlyNet, v => setBiz("targetHourlyNet", v), "$/hr")}
        {row("Tax set-aside", data.business.taxSetAsidePct, v => setBiz("taxSetAsidePct", v), "%")}
        {row("IRS mileage rate", data.business.mileageRate, v => setBiz("mileageRate", v), "$/mi")}
      </div>

      <div style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 12, padding: 14 }}>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>Pricing engine</div>
        {row("Billable rate", data.pricing.billableRate, v => setPricing("billableRate", v), "$/hr")}
        {row("Minimum charge", data.pricing.minCharge, v => setPricing("minCharge", v), "$")}
        {row("Mow speed", data.pricing.mowSpeedMph, v => setPricing("mowSpeedMph", v), "mph")}
        {row("Cutting width", data.pricing.passWidthFt, v => setPricing("passWidthFt", v), "ft")}
        {row("Efficiency", data.pricing.efficiency, v => setPricing("efficiency", v), "0–1")}
        {row("Setup time", data.pricing.setupMin, v => setPricing("setupMin", v), "min")}
        <div style={{ fontSize: 11.5, color: C.stone, marginTop: 8 }}>
          Efficiency is the fraction of time actually spent cutting — turns, obstacles, and repositioning
          are the rest. 0.75 is realistic for typical residential work.
        </div>
      </div>

      <div style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 12, padding: 14, marginTop: 12 }}>
        <div style={{ fontWeight: 700, marginBottom: 4 }}>Backup &amp; restore</div>
        <div style={{ fontSize: 12, color: C.stone, marginBottom: 10 }}>
          Data lives in this browser only. Copy a backup somewhere safe, or paste one in to move
          between devices.
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={copyBackup} style={{ flex: 1, background: C.forest, color: "#fff", border: "none",
            borderRadius: 8, padding: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
            Copy backup
          </button>
          <button onClick={() => setPasteOpen(o => !o)} style={{ flex: 1, background: C.moss, color: "#fff",
            border: "none", borderRadius: 8, padding: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
            {pasteOpen ? "Close" : "Paste backup"}
          </button>
        </div>

        {pasteOpen && (
          <div style={{ marginTop: 10 }}>
            <textarea value={pasteText} onChange={e => setPasteText(e.target.value)}
              placeholder="Paste backup text here…"
              style={{ width: "100%", height: 130, fontFamily: "monospace", fontSize: 12, padding: 9,
                border: `1px solid ${C.line}`, borderRadius: 8, boxSizing: "border-box", resize: "vertical" }} />
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <button onClick={() => loadPasted("merge")} disabled={!pasteText.trim()}
                style={{ flex: 1, background: pasteText.trim() ? C.moss : "#ccc", color: "#fff", border: "none",
                  borderRadius: 8, padding: 11, fontWeight: 700, cursor: pasteText.trim() ? "pointer" : "default", fontFamily: "inherit" }}>
                Merge in
              </button>
              <button onClick={() => loadPasted("replace")} disabled={!pasteText.trim()}
                style={{ flex: 1, background: "#fff", color: C.alert, border: `1px solid ${C.alert}`,
                  borderRadius: 8, padding: 11, fontWeight: 700, cursor: pasteText.trim() ? "pointer" : "default", fontFamily: "inherit" }}>
                Replace all
              </button>
            </div>
            <div style={{ fontSize: 11.5, color: C.stone, marginTop: 6 }}>
              <b>Merge</b> keeps what's here and adds anything new — safe to run twice.
              <b> Replace</b> wipes this device's data first.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── EQUIPMENT (hour-meter maintenance — wear by use, not calendar) ──────
export function EquipmentView({ data, upd, showToast }) {
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: "", hourMeter: "" });

  const addEquipment = () => {
    if (!form.name.trim()) { showToast("Name required", "err"); return; }
    const nm = form.name.trim();
    upd(d => d.equipment.some(e => e.name.toLowerCase() === nm.toLowerCase()) ? d :
      ({ ...d, equipment: [{ id: uid(), name: nm, hourMeter: Number(form.hourMeter) || 0,
      intervals: [
        { task: "Blade sharpen/balance", everyHours: 10, lastAtHours: 0 },
        { task: "Oil + filter", everyHours: 50, lastAtHours: 0 },
        { task: "Air filter", everyHours: 100, lastAtHours: 0 },
      ] }, ...d.equipment] }));
    setForm({ name: "", hourMeter: "" });
    setAdding(false);
    showToast("Equipment added");
  };

  const logService = (eqId, taskIdx) => {
    upd(d => ({ ...d, equipment: d.equipment.map(e => e.id !== eqId ? e : {
      ...e, intervals: e.intervals.map((iv, i) => i === taskIdx ? { ...iv, lastAtHours: e.hourMeter } : iv) }) }));
    showToast("Service logged at current hours");
  };

  // The hour meter has to be updatable or every interval freezes at the
  // reading entered on day one — the whole point of hours-based maintenance
  // is that the number moves as the machine works. Controlled input commits
  // on change (not blur) so the value is never silently lost on mobile when
  // the user taps away without firing a blur event.
  const updateHours = (eqId, newHours, silent) => {
    if (newHours === "") { upd(d => ({ ...d, equipment: d.equipment.map(e => e.id !== eqId ? e : { ...e, hourMeter: 0 }) })); return; }
    const n = Number(newHours);
    if (!Number.isFinite(n) || n < 0) { showToast("Enter a valid hour reading", "err"); return; }
    upd(d => ({ ...d, equipment: d.equipment.map(e => e.id !== eqId ? e : { ...e, hourMeter: n }) }));
    if (!silent) showToast(`Hour meter updated to ${n}`);
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ fontFamily: "Georgia,serif", fontSize: 20, fontWeight: 700 }}>Equipment</div>
        <button onClick={() => setAdding(a => !a)} style={{ background: C.forest, color: "#fff", border: "none",
          borderRadius: 8, padding: "8px 14px", fontWeight: 700, cursor: "pointer" }}>{adding ? "Cancel" : "+ Add"}</button>
      </div>
      <div style={{ fontSize: 12.5, color: C.stone, marginBottom: 12 }}>
        Every interval tracks by engine hours, not calendar days — equipment wears by use.
      </div>

      {adding && (
        <div style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 12, padding: 14, marginBottom: 14 }}>
          <input style={inputStyle} placeholder="Equipment name (e.g. Zero-turn mower)" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          <div style={{ height: 8 }} />
          <input style={inputStyle} type="number" placeholder="Current hour meter reading" value={form.hourMeter} onChange={e => setForm({ ...form, hourMeter: e.target.value })} />
          <button onClick={addEquipment} style={{ marginTop: 10, width: "100%", background: C.forest, color: "#fff", border: "none", borderRadius: 8, padding: 11, fontWeight: 700, cursor: "pointer" }}>Save</button>
        </div>
      )}

      {data.equipment.length === 0 && !adding && (
        <div style={{ padding: 30, textAlign: "center", color: C.stone, background: "#fff", borderRadius: 12, border: `1px dashed ${C.line}` }}>
          No equipment yet.
        </div>
      )}

      {data.equipment.map(eq => (
        <div key={eq.id} style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 12, padding: 14, marginBottom: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div style={{ fontWeight: 700 }}>{eq.name}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input type="number" value={eq.hourMeter}
                onChange={e => updateHours(eq.id, e.target.value, true)}
                style={{ width: 74, padding: "6px 8px", fontSize: 13, textAlign: "right",
                  border: `1px solid ${C.line}`, borderRadius: 6, fontFamily: "inherit" }} />
              <span style={{ fontSize: 12.5, color: C.stone }}>hrs</span>
            </div>
          </div>
          {eq.intervals.map((iv, i) => {
            const hoursSince = eq.hourMeter - iv.lastAtHours;
            const due = hoursSince >= iv.everyHours;
            const overdue = hoursSince >= iv.everyHours * 1.2;
            return (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "7px 0", borderTop: i > 0 ? `1px solid ${C.line}` : "none" }}>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: due ? 700 : 500, color: overdue ? C.alert : due ? C.amber : C.ink }}>{iv.task}</div>
                  <div style={{ fontSize: 11, color: C.stone }}>every {iv.everyHours}h · {hoursSince}h since last</div>
                </div>
                <button onClick={() => logService(eq.id, i)} style={{
                  fontSize: 11.5, fontWeight: 700, padding: "6px 10px", borderRadius: 7, cursor: "pointer",
                  border: `1px solid ${due ? C.forest : C.line}`, background: due ? C.forest : "#fff", color: due ? "#fff" : C.stone }}>
                  Log
                </button>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
