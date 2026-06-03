// Post-build patch for the Firefox dist manifest.
//
// Parcel only emits `background.service_worker` (it rejects `background.scripts`
// and rejects both keys together), but Firefox doesn't support service workers —
// it needs `background.scripts`. Mozilla's recommended cross-browser form is to
// declare BOTH keys pointing at the same background file; Chrome uses
// service_worker, Firefox uses scripts. We can't express that pre-build (Parcel
// won't pass it through), so we add `scripts` to the already-emitted manifest.
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

manifest.background = {
    ...manifest.background,
    // Firefox loads this; Chrome ignores it in favour of service_worker.
    scripts: [serviceWorker],
};

writeFileSync(manifestPath, JSON.stringify(manifest, null, 4) + "\n");
console.log(`[patch-firefox-manifest] added background.scripts -> ${serviceWorker}`);
