# Groundskeeper

**The operating system for a one-person lawn business.**

Live demo: https://groundskeeper-app.netlify.app

---

## Why this exists

Every lawn-care product on the market is built for a company with an office, a dispatcher, and a bookkeeper. A solo contractor doesn't have those roles — they *are* those roles, standing in a driveway. Groundskeeper is built from how a solo operator actually works.

## Six things this gets right that templates don't

1. **Cash-basis accounting, correctly modeled.** Income counts the day it's *collected*, not the day the job was done — the legally correct method for a solo contractor filing Schedule C on the cash method. Most demo apps sum by job date and quietly produce wrong tax numbers.
2. **Hour-meter maintenance, not calendar maintenance.** Equipment wears by use. Intervals track against each machine's own hour meter.
3. **Live pricing engine with a margin check.** Lot size → mow/trim time → price, plus the contractor's real net $/hour after drive cost, flagged red if it falls under their target. Stops a losing quote before it goes out.
4. **Zone-based route planning.** The week auto-fills from recurring clients and sorts each day by zone. Clients with no fixed day still get dealt in — nothing falls through.
5. **Quote → client in one tap.** Accepting a quote creates the client at the quoted rate. No re-typing into a second system.
6. **Tax awareness built into daily use.** Mileage at the IRS rate, expense categories, and a running quarterly set-aside — computed from data already being entered.

## Running it

No build step required. Clone and open `index.html`, or serve the directory:

```bash
python3 -m http.server 8000
```

Source lives in `src/`. To rebuild the bundle:

```bash
npx esbuild src/entry.jsx --bundle --minify --format=iife \
  --target=es2018 --jsx=automatic --outfile=app.bundle.js
```

## Architecture

- React 18, hooks only. Zero UI libraries — inline styles, hand-written SVG icons.
- Single minified IIFE (~178KB), no backend needed for the demo.
- Storage isolated behind a `db` adapter, so swapping localStorage for a real API is a contained change.
- Schema-versioned with type-validating migration — malformed or wrong-typed saved data degrades gracefully instead of white-screening.
- `priceQuote()` is a pure function: no side effects, trivially testable, demoable in isolation.

## Verification

Every component was executed in a headless DOM with realistic data, not just parsed. Seven real defects were found and fixed this way, including a bundle that would have rendered a blank screen on load, a missing payment-collection path that made the flagship cash-basis feature a dead end, and a divide-by-zero that printed `$Infinity`.

The pricing engine was run against 390 degenerate input combinations (zero, negative, NaN, undefined, string, oversized) with zero NaN, Infinity, or negative-price results. Ten hostile storage states — invalid JSON, wrong-typed collections, orphaned references — all load cleanly. All create actions are idempotent under rapid double-tap.

Accounting was verified to the cent: a $37.50 job logged, collected, and re-read after a full page reload yields exactly $37.50 collected, $0.00 outstanding, and a correct set-aside, with income attributed to the collection date.
