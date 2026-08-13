// Pure-function tests: pricing engine, cash-basis accounting, and migration
// safety. These run without a DOM — fast, and they pin down exactly which
// function is wrong when something fails, instead of "the app looked off."
import { loadCore, section, check, near } from "./harness.mjs";

export default async function run() {
  const C = await loadCore();

  section("Pricing engine — normal cases");
  const P = { mowSpeedMph: 4, passWidthFt: 4.33, efficiency: 0.75, trimBaseMin: 3,
    trimPerKSqFt: 2, blowBaseMin: 2, setupMin: 6, billableRate: 85, minCharge: 45, roundTo: 5 };
  const e1 = C.priceQuote(20000, 1, P);
  check("20,000 sqft with light obstacles prices above the minimum", e1.price > P.minCharge, e1.price);
  check("mow time is a meaningful share of total time", e1.mowMin > 0 && e1.mowMin < e1.totalMin);
  const e2 = C.priceQuote(500, 0, P);
  check("a tiny lot hits the minimum charge floor", e2.price === P.minCharge, e2.price);
  const e2b = C.priceQuote(8000, 1, P);
  check("a lot whose computed price is below minimum also floors at exactly minCharge, not below it",
    e2b.price === P.minCharge, e2b.price);
  const e3 = C.priceQuote(20000, 2, P);
  const e4 = C.priceQuote(20000, 0, P);
  check("heavy obstacles cost more than open lawn at the same lot size", e3.price >= e4.price, [e3.price, e4.price]);

  section("Pricing engine — degenerate inputs never crash or go negative");
  let badCount = 0;
  const degenerate = [
    { ...P, efficiency: 0 }, { ...P, efficiency: -1 }, { ...P, billableRate: -100 },
    { ...P, roundTo: 0 }, { ...P, mowSpeedMph: 0 }, { ...P, passWidthFt: 0 },
    Object.fromEntries(Object.keys(P).map(k => [k, 0])),
    Object.fromEntries(Object.keys(P).map(k => [k, "not a number"])),
  ];
  for (const p of degenerate) {
    for (const lot of [0, -500, 8000, 99999999]) {
      for (const obs of [0, 1, 2, -1, 99]) {
        const e = C.priceQuote(lot, obs, p);
        const m = C.marginCheck(e, 45, 0.3, 6);
        const vals = [e.price, e.totalHrs, e.mowMin, e.trimMin, m.netPerHour, m.driveCost];
        if (vals.some(v => !Number.isFinite(v)) || e.price < 0) badCount++;
      }
    }
  }
  check("all degenerate-input combinations stay finite and non-negative", badCount === 0, badCount);

  section("Cash-basis accounting");
  const round2 = n => Math.round(n * 100) / 100;
  const visits = [
    { amount: 40, paid: true, paidDate: "2026-08-04" },
    { amount: 60, paid: false, paidDate: null },
    { amount: 25.5, paid: true, paidDate: "2026-08-05" },
  ];
  const collected = round2(visits.filter(v => v.paid).reduce((s, v) => s + v.amount, 0));
  const outstanding = round2(visits.filter(v => !v.paid).reduce((s, v) => s + v.amount, 0));
  check("collected sums only paid visits", collected === 65.5, collected);
  check("outstanding sums only unpaid visits", outstanding === 60, outstanding);
  check("collected + outstanding equals everything logged",
    near(collected + outstanding, visits.reduce((s, v) => s + v.amount, 0)));

  section("Migration — type safety against corrupt saved data");
  const cases = [
    ["null", null], ["undefined", undefined], ["a string", "not an object"],
    ["an array", [1, 2, 3]], ["clients as a string", { clients: "oops", visits: [] }],
    ["visits missing entirely", { clients: [] }],
    ["a row with no id", { clients: [{ name: "no id" }], visits: [] }],
    ["equipment with no intervals array", { equipment: [{ id: "e1", name: "X" }] }],
  ];
  for (const [label, input] of cases) {
    let ok = true, out = null;
    try { out = C.migrate(input); }
    catch { ok = false; }
    check(`migrate(${label}) does not throw`, ok);
    if (ok) {
      check(`migrate(${label}) returns real arrays for every collection`,
        ["clients", "visits", "expenses", "mileage", "quotes", "plannedStops", "equipment"]
          .every(k => Array.isArray(out[k])));
    }
  }

  section("Migration — valid data passes through intact");
  const goodClient = { id: "c1", status: "active", name: "Test Client", address: "123 Main",
    phone: "5551234567", rate: 60, zone: "", scheduleDays: [], frequency: "weekly", notes: "" };
  const migrated = C.migrate({ clients: [goodClient], visits: [] });
  check("a well-formed client survives migration with the same id",
    migrated.clients.some(c => c.id === "c1"));
  check("a well-formed client keeps its rate",
    migrated.clients.find(c => c.id === "c1")?.rate === 60);
}
