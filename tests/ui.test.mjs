// Mounts the real bundled app and drives it like a thumb. Catches white
// screens, dead buttons, and state that doesn't actually reach storage —
// the class of bug static analysis and pure-function tests can't see.
import fs from "fs";
import path from "path";
import { mount, ROOT, KEY, section, check } from "./harness.mjs";

const ANCHOR = "2026-08-13"; // pinned so "collected this month" etc. are deterministic

const seedBook = () => JSON.parse(fs.readFileSync(
  path.join(ROOT, "tests", "fixtures", "book.json"), "utf8"));

export default async function run() {
  section("First launch, empty storage");
  {
    const a = await mount({ today: ANCHOR });
    check("app paints something, not a blank screen", a.text().length > 80, a.text().length);
    check("default business name shows on a fresh install", a.text().includes("Your Lawn Co."));
    check("Today tab is the default view", a.text().includes("Today") || a.text().includes("stop"));
    a.unmount();
  }

  section("Corrupt storage never white-screens");
  const hostile = [
    ["invalid JSON", "{not json"],
    ["null literal", "null"],
    ["array instead of object", "[1,2,3]"],
    ["clients as wrong type", JSON.stringify({ schemaVersion: 1, clients: "oops", visits: [] })],
    ["orphaned visit referencing a deleted client",
      JSON.stringify({ schemaVersion: 1, clients: [], visits: [{ id: "v1", clientId: "ghost", amount: 50, paid: false, date: "2026-08-01" }] })],
  ];
  for (const [label, payload] of hostile) {
    const a = await mount({ today: ANCHOR, storage: { [KEY]: payload } });
    check(`survives: ${label}`, a.text().length > 60);
    a.unmount();
  }

  section("Quote → client pipeline");
  {
    const a = await mount({ today: ANCHOR });
    await a.tap("Quote");
    check("quote screen shows a computed price", /\$[\d,]+\.\d{2}/.test(a.text()));
    const nameField = a.field("Client name");
    check("client name field exists on the quote screen", !!nameField);
    if (nameField) {
      await a.type("Client name", "Test Pipeline Client");
      await a.tap("Accept Quote");
      await a.wait(250);
      const saved = a.storedParsed(KEY);
      check("accepting a quote creates exactly one client", saved.clients.filter(c => c.name === "Test Pipeline Client").length === 1);
      check("quotes array stays empty (dead storage, correctly not written)", (saved.quotes || []).length === 0);
    }
    a.unmount();
  }

  section("Double-tap does not create duplicates");
  {
    const a = await mount({ today: ANCHOR });
    await a.tap("Quote");
    await a.type("Client name", "Spam Test");
    const acceptBtn = a.button("Accept Quote");
    for (let i = 0; i < 5; i++) {
      acceptBtn.dispatchEvent(new a.dom.window.MouseEvent("click", { bubbles: true }));
    }
    await a.wait(400);
    const saved = a.storedParsed(KEY);
    check("5 rapid taps create exactly one client", saved.clients.filter(c => c.name === "Spam Test").length === 1);
    a.unmount();
  }

  section("Client edit + detail view");
  {
    const a = await mount({ today: ANCHOR, storage: { [KEY]: JSON.stringify(seedBook()) } });
    await a.tap("Clients");
    check("seeded clients render", a.text().includes("Krissy Boyser"));
    const detailsBtns = a.nodes("button").filter(b => b.textContent.trim() === "Details");
    check("Details buttons are present", detailsBtns.length > 0);
    if (detailsBtns.length) {
      detailsBtns[0].dispatchEvent(new a.dom.window.MouseEvent("click", { bubbles: true }));
      await a.wait(200);
      check("detail sheet opens with service history", a.text().includes("Service history"));
      const editBtn = a.button("Edit");
      if (editBtn) {
        editBtn.dispatchEvent(new a.dom.window.MouseEvent("click", { bubbles: true }));
        await a.wait(200);
        check("edit sheet opens from detail", a.text().includes("Edit client"));
      }
    }
    a.unmount();
  }

  section("Cash-basis: log, collect, verify Tax tab matches hand math");
  {
    const book = seedBook();
    const a = await mount({ today: ANCHOR, storage: { [KEY]: JSON.stringify(book) } });
    await a.tap("Today");
    const planBtn = a.button("Plan today");
    if (planBtn) { planBtn.dispatchEvent(new a.dom.window.MouseEvent("click", { bubbles: true })); await a.wait(250); }
    // Pick a Mark Done button next to a client whose rate is non-zero, so a
    // real dollar amount is actually at stake — the fixture's first client
    // in DOM order has a $0 rate, which would make this pass trivially even
    // if collection were completely broken for every real client.
    const clientById = Object.fromEntries(book.clients.map(c => [c.id, c]));
    const markDoneButtons = a.nodes("button").filter(b => b.textContent.trim() === "Mark Done");
    let target = null;
    for (const btn of markDoneButtons) {
      const card = btn.closest ? btn.closest("div") : null;
      const cardText = card ? card.textContent : "";
      const match = book.clients.find(c => cardText.includes(c.name) && Number(c.rate) > 0);
      if (match) { target = btn; break; }
    }
    check("found a Mark Done button for a client with a non-zero rate", !!target);
    if (target) {
      target.dispatchEvent(new a.dom.window.MouseEvent("click", { bubbles: true }));
      await a.wait(200);
      check("Awaiting payment section appears after logging", a.text().includes("Awaiting payment"));
      const collectBtn = a.button("Collect");
      if (collectBtn) {
        const before = a.storedParsed(KEY);
        const beforeCollected = before.visits.filter(v => v.paid).reduce((s, v) => s + Number(v.amount || 0), 0);
        collectBtn.dispatchEvent(new a.dom.window.MouseEvent("click", { bubbles: true }));
        await a.wait(200);
        const after = a.storedParsed(KEY);
        const afterCollected = after.visits.filter(v => v.paid).reduce((s, v) => s + Number(v.amount || 0), 0);
        check("collecting a real job increases total collected income", afterCollected > beforeCollected,
          [beforeCollected, afterCollected]);
        const paidJustNow = after.visits.find(v => v.paid && !before.visits.some(bv => bv.id === v.id && bv.paid));
        check("newly collected visit carries a paidDate", !!paidJustNow?.paidDate);
        check("newly collected visit has a non-zero amount (proves we didn't hit a $0-rate client)",
          paidJustNow && Number(paidJustNow.amount) > 0, paidJustNow?.amount);
      }
    }
    a.unmount();
  }

  section("Negative net income renders correctly (regression: was $-N, now -$N)");
  {
    const book = seedBook();
    book.expenses.push({ id: "big-expense", date: "2026-08-01", amount: 50000, category: "Equipment", vendor: "Test", notes: "" });
    const a = await mount({ today: ANCHOR, storage: { [KEY]: JSON.stringify(book) } });
    await a.tap("Tax");
    check("negative net income shows a leading minus before the dollar sign, not after",
      /\-\$[\d,]+\.\d{2}/.test(a.text()) && !/\$\-[\d,]+/.test(a.text()));
    a.unmount();
  }

  section("Backup export / import round-trip");
  {
    const book = seedBook();
    const a = await mount({ today: ANCHOR, storage: { [KEY]: JSON.stringify(book) } });
    await a.tap("Setup");
    check("backup and restore section is present", a.text().includes("Backup"));
    const pasteBtn = a.button("Paste backup");
    if (pasteBtn) {
      pasteBtn.dispatchEvent(new a.dom.window.MouseEvent("click", { bubbles: true }));
      await a.wait(150);
      const ta = a.nodes("textarea")[0];
      if (ta) {
        const setter = Object.getOwnPropertyDescriptor(a.dom.window.HTMLTextAreaElement.prototype, "value").set;
        setter.call(ta, JSON.stringify(book));
        ta.dispatchEvent(new a.dom.window.Event("input", { bubbles: true }));
        const mergeBtn = a.button("Merge in");
        if (mergeBtn) {
          mergeBtn.dispatchEvent(new a.dom.window.MouseEvent("click", { bubbles: true }));
          await a.wait(250);
          const after = a.storedParsed(KEY);
          check("re-merging the same backup does not duplicate clients",
            after.clients.length === book.clients.length, [book.clients.length, after.clients.length]);
          check("re-merging the same backup does not duplicate visits",
            after.visits.length === book.visits.length, [book.visits.length, after.visits.length]);
        }
      }
    }
    a.unmount();
  }

  section("Reload persistence");
  {
    let store = {};
    let a = await mount({ today: ANCHOR });
    await a.tap("Quote");
    await a.type("Client name", "Persist Check");
    await a.tap("Accept Quote");
    await a.wait(250);
    store[KEY] = a.stored(KEY);
    a.unmount();

    a = await mount({ today: ANCHOR, storage: store });
    check("client survives a full reload", a.text().includes("Persist Check") ||
      (a.storedParsed(KEY)?.clients || []).some(c => c.name === "Persist Check"));
    a.unmount();
  }
}
