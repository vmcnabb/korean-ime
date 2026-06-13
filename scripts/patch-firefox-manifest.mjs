// Post-build patch for the Firefox dist manifest.
//
// Parcel only emits `background.service_worker` (it rejects `background.scripts`
// and rejects both keys together), but Firefox doesn't support service workers —
// it needs `background.scripts`. Since this is a Firefox-only manifest (Chrome
// gets its own build), we swap the keys outright: drop the `service_worker` key
// Firefox would ignore and point `scripts` at the same emitted file. We can't
// express `scripts` pre-build (Parcel won't pass it through), so we rewrite the
// already-emitted manifest here.
//
// Mozilla's dual-key form — declaring BOTH keys in one manifest — only helps when
// a single manifest is shared across browsers (Chrome reads service_worker,
// Firefox reads scripts). We ship per-browser manifests, so keeping service_worker
// here would just earn web-ext's BACKGROUND_SERVICE_WORKER_IGNORED warning for no
// benefit.
//
// Parcel inlines the background into a single self-contained classic script, so
// pointing `scripts` at the same emitted file is exactly what Firefox wants.
//
// Usage: node scripts/patch-firefox-manifest.mjs [distDir]   (default: dist-firefox)

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const distDir = resolve(root, process.argv[2] ?? "dist-firefox");
const manifestPath = resolve(distDir, "manifest.json");

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

const serviceWorker = manifest.background?.service_worker;
if (!serviceWorker) {
    console.error("[patch-firefox-manifest] no background.service_worker found in emitted manifest");
    process.exit(1);
}

// Firefox-only manifest: swap service_worker -> scripts, preserving any other
// background keys (e.g. `type`).
delete manifest.background.service_worker;
manifest.background.scripts = [serviceWorker];

writeFileSync(manifestPath, JSON.stringify(manifest, null, 4) + "\n");
console.log(`[patch-firefox-manifest] background.scripts -> ${serviceWorker} (dropped service_worker)`);
