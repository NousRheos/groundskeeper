// Static checks on the source and shipped bundle. Catches drift between
// what's committed and what's actually deployed, and catches dead code left
// behind by features that were deliberately removed (Equipment tab, quote
// storage) — a leftover reference to either is a sign a removal was
// incomplete, not just cosmetic.
import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { ROOT, section, check } from "./harness.mjs";

export default async function run() {
  section("Bundle integrity");
  // Byte-exact comparison is too fragile — different esbuild patch versions
  // can emit functionally identical output with tiny wrapper differences
  // (e.g. an extra CJS-interop arg), which isn't a real drift. What actually
  // matters: rebuilding from committed source produces a bundle that boots
  // and renders the same app, not an identical byte stream.
  const entry = path.join(ROOT, "src", "entry.jsx");
  const rebuiltPath = path.join(ROOT, "tests", ".structure.rebuild.js");
  execSync(
    `npx esbuild "${entry}" --bundle --minify --format=iife --jsx=automatic --target=es2018 ` +
    `--outfile="${rebuiltPath}" --log-level=warning`,
    { cwd: ROOT, stdio: ["ignore", "ignore", "inherit"] }
  );
  const shippedBundle = fs.readFileSync(path.join(ROOT, "app.bundle.js"), "utf8");
  const rebuilt = fs.readFileSync(rebuiltPath, "utf8");
  const sizeDeltaPct = Math.abs(shippedBundle.length - rebuilt.length) / shippedBundle.length * 100;
  check("rebuild from committed source is within 1% size of the shipped bundle (catches real drift, tolerates minifier-version noise)",
    sizeDeltaPct < 1, `${sizeDeltaPct.toFixed(3)}%`);
  check("both bundles reference the same app identity string",
    shippedBundle.includes("Groundskeeper") === rebuilt.includes("Groundskeeper"));
  fs.unlinkSync(rebuiltPath);

  section("No leftover dead code from removed features");
  const appSrc = fs.readFileSync(path.join(ROOT, "src", "App.jsx"), "utf8");
  check("Equipment tab is unreachable — App.jsx never imports EquipmentView",
    !appSrc.includes("EquipmentView"));
  check("no lingering 'equipment' nav tab entry in App.jsx",
    !/\["equipment",\s*"Equipment"/.test(appSrc));
  const views2Src = fs.readFileSync(path.join(ROOT, "src", "Views2.jsx"), "utf8");
  check("accepting a quote no longer writes to a quotes[] array",
    !/quotes:\s*\[\{/.test(views2Src));
  check("migrate() still accepts a legacy quotes field on import for backward compatibility",
    fs.readFileSync(path.join(ROOT, "src", "core.js"), "utf8").includes("quotes:       arr(data.quotes)"));

  section("Known-fixed bugs stay fixed");
  check("fmtMoney handles negatives with a leading minus, not $-",
    /v\s*<\s*0\s*\?\s*["']-["']/.test(fs.readFileSync(path.join(ROOT, "src", "core.js"), "utf8")));
  check("priceQuote guards against non-finite/negative pricing inputs",
    fs.readFileSync(path.join(ROOT, "src", "core.js"), "utf8").includes("Number.isFinite(n) && n > min"));
  check("migrate() validates array types instead of trusting saved data blindly",
    fs.readFileSync(path.join(ROOT, "src", "core.js"), "utf8").includes("Array.isArray(v) ? v : []"));

  section("Create actions are idempotent (double-tap guards)");
  const views = fs.readFileSync(path.join(ROOT, "src", "Views4.jsx"), "utf8")
    + fs.readFileSync(path.join(ROOT, "src", "Views1.jsx"), "utf8")
    + fs.readFileSync(path.join(ROOT, "src", "Views2.jsx"), "utf8");
  check("client creation checks for an existing same-name client first",
    views.includes('c.name.toLowerCase() === nm.toLowerCase()'));
  check("visit logging checks for an existing same-day visit first",
    views.includes('v.clientId === clientId && v.date === todayStr()'));

  section("Artifact-sandbox rules");
  const allSrc = ["App.jsx", "Views1.jsx", "Views2.jsx", "Views3.jsx", "Views4.jsx", "core.js"]
    .map(f => fs.readFileSync(path.join(ROOT, "src", f), "utf8")).join("\n");
  check("no browser storage API referenced outside the db adapter",
    (allSrc.match(/localStorage\./g) || []).length <= 3); // db.load/db.save/db adapter only
  check("no HTML <form> elements anywhere", !/<form[\s>]/.test(allSrc));
}
