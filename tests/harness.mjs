// Shared plumbing for the Groundskeeper test suite. Mirrors TLC-Tracker's
// harness pattern: real component mount in a real DOM, driven like a thumb,
// with a pinnable clock so date-dependent assertions never silently flip
// pass/fail depending on which real calendar day the suite happens to run.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";
import { JSDOM } from "jsdom";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const KEY = "groundskeeper_v1";

/* ── assertions ─────────────────────────────────────────────────────── */
let results = [];
export const section = name => console.log(`\n── ${name}`);
export const check = (label, pass, detail) => {
  results.push({ label, pass });
  const d = detail === undefined ? "" : "  → " + JSON.stringify(detail);
  console.log(`${pass ? "  pass" : "  FAIL"} · ${label}${d}`);
  return pass;
};
export const near = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;
export const summary = () => {
  const bad = results.filter(r => !r.pass);
  console.log(`\n${results.length - bad.length}/${results.length} passed`);
  bad.forEach(r => console.log(`  FAILED: ${r.label}`));
  return bad.length;
};

/* ── core.js loaded directly — pure functions, no DOM needed ─────────── */
export async function loadCore() {
  return import(path.join(ROOT, "src", "core.js") + "?v=" + Date.now());
}

/* ── bundle + mount the real app in a real DOM ─────────────────────────
   Rebuilds from src/ every call so tests can never pass against a stale
   bundle — same principle as TLC's "extracted verbatim from the shipped
   file" comment, adapted for a multi-file esbuild project instead of a
   single Babel-transformed file. */
export async function mount({ storage = {}, today } = {}) {
  const bundlePath = path.join(ROOT, "tests", ".app.generated.js");
  execSync(
    `npx esbuild "${path.join(ROOT, "src", "entry.jsx")}" --bundle --format=iife ` +
    `--jsx=automatic --target=es2018 --outfile="${bundlePath}" --log-level=warning`,
    { cwd: ROOT, stdio: ["ignore", "ignore", "inherit"] }
  );

  const dom = new JSDOM(`<!doctype html><html><body><div id="root"></div></body></html>`,
    { url: "https://groundskeeper-app.netlify.app", pretendToBeVisual: true, runScripts: "dangerously" });
  Object.defineProperty(dom.window, "localStorage", { configurable: true, value: {
    getItem: k => (k in storeShim ? storeShim[k] : null),
    setItem: (k, v) => { storeShim[k] = String(v); },
    removeItem: k => { delete storeShim[k]; },
    clear: () => { for (const k of Object.keys(storeShim)) delete storeShim[k]; },
  }});
  const storeShim = { ...storage };
  global.window = dom.window;
  global.document = dom.window.document;
  Object.defineProperty(global, "navigator", { value: dom.window.navigator, configurable: true, writable: true });
  global.HTMLElement = dom.window.HTMLElement;
  global.Element = dom.window.Element;
  global.Node = dom.window.Node;
  global.localStorage = dom.window.localStorage;
  global.requestAnimationFrame = cb => setTimeout(cb, 0);
  global.cancelAnimationFrame = clearTimeout;

  // Pin the clock for this mount so date-dependent behavior (Today's plan,
  // "collected this month", week auto-fill) is deterministic regardless of
  // the real day the suite executes. Restored on unmount so one pinned test
  // can never leak its fake clock into the next test.
  let restoreDate = null;
  if (today) {
    const RealDate = Date;
    const fixedMs = new RealDate(today + "T12:00:00").getTime();
    class FixedDate extends RealDate {
      constructor(...args) { super(...(args.length ? args : [fixedMs])); }
      static now() { return fixedMs; }
    }
    global.Date = FixedDate;
    dom.window.Date = FixedDate;
    restoreDate = () => { global.Date = RealDate; dom.window.Date = RealDate; };
  }

  const script = dom.window.document.createElement("script");
  script.textContent = fs.readFileSync(bundlePath, "utf8");
  dom.window.document.body.appendChild(script);
  await new Promise(r => setTimeout(r, 450));

  const container = dom.window.document.getElementById("root");
  const text = () => container.textContent;
  const nodes = sel => [...dom.window.document.querySelectorAll(sel)];
  const button = label => nodes("button").find(b => (b.textContent || "").trim() === label)
                       || nodes("button").find(b => (b.textContent || "").trim().startsWith(label));
  const tap = async label => {
    const el = button(label);
    if (!el) throw new Error(`nothing on screen to tap: "${label}"`);
    el.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
    await new Promise(r => setTimeout(r, 170));
  };
  const field = ph => nodes("input").find(i => i.placeholder === ph);
  const type = async (ph, value) => {
    const el = field(ph);
    if (!el) throw new Error(`no input with placeholder "${ph}"`);
    const proto = el.tagName === "TEXTAREA" ? dom.window.HTMLTextAreaElement
      : el.tagName === "SELECT" ? dom.window.HTMLSelectElement : dom.window.HTMLInputElement;
    Object.getOwnPropertyDescriptor(proto.prototype, "value").set.call(el, value);
    el.dispatchEvent(new dom.window.Event(el.tagName === "SELECT" ? "change" : "input", { bubbles: true }));
    await new Promise(r => setTimeout(r, 100));
  };
  const check_ = ph => nodes("input").find(i => i.type === "checkbox" && i.placeholder === ph);
  const setChecked = async (el, v) => {
    const setter = Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, "checked").set;
    setter.call(el, v);
    el.dispatchEvent(new dom.window.Event("click", { bubbles: true }));
    el.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
    await new Promise(r => setTimeout(r, 100));
  };
  const valueOf = ph => (field(ph) || {}).value;
  const stored = key => storeShim[key] ?? null;
  const storedParsed = key => { const s = stored(key); return s ? JSON.parse(s) : null; };
  const wait = async ms => new Promise(r => setTimeout(r, ms));
  const unmount = () => { if (restoreDate) restoreDate(); };

  return { dom, text, nodes, button, tap, type, field, setChecked, valueOf, stored, storedParsed, wait, unmount };
}
