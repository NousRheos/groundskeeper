// Run everything: node tests/run.mjs
// Run one layer:  node tests/run.mjs structure | logic | ui
// Exits non-zero if anything fails, so it can gate a deploy.
import { summary } from "./harness.mjs";

const only = process.argv[2];
const layers = [
  ["structure", "./structure.test.mjs"],
  ["logic",     "./logic.test.mjs"],
  ["ui",        "./ui.test.mjs"],
].filter(([name]) => !only || name === only);

if (!layers.length) {
  console.log(`unknown layer "${only}" — use structure, logic, or ui`);
  process.exit(2);
}

const t0 = Date.now();
for (const [name, file] of layers) {
  console.log(`\n${"═".repeat(58)}\n  ${name.toUpperCase()}\n${"═".repeat(58)}`);
  const mod = await import(file);
  try {
    await mod.default();
  } catch (e) {
    console.log(`\n  FAIL · ${name} threw: ${e.message}`);
    console.log(e.stack.split("\n").slice(1, 4).join("\n"));
    process.exitCode = 1;
  }
}

const failed = summary();
console.log(`${((Date.now() - t0) / 1000).toFixed(1)}s`);
if (failed) process.exitCode = 1;
