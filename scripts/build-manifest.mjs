// Generates src/manifest.json from src/manifest.base.json for a given browser
// target. The generated manifest is a build artifact (gitignored) — the base
// file plus package.json's version plus the per-target overrides below are the
// real source of truth.
//
// Parcel's webextension transformer requires the manifest to be named exactly
// `manifest.json` and to sit beside the assets it references (so relative paths
// like images/ and _locales/ resolve), which is why we generate in place at
// src/manifest.json rather than a sibling name or subdirectory.
//
// Usage: node scripts/build-manifest.mjs <target>      (default: chrome)

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const basePath = resolve(root, "src/manifest.base.json");
const outPath = resolve(root, "src/manifest.json");
const pkgPath = resolve(root, "package.json");

// Per-target overrides merged onto the base manifest. Firefox is added here later.
const targets = {
    chrome: {
        minimum_chrome_version: "102",
        background: {
            service_worker: "service-worker/service-worker.ts",
            type: "module",
        },
    },
};

const target = process.argv[2] ?? "chrome";
const overrides = targets[target];

if (!overrides) {
    console.error(`[build-manifest] unknown target "${target}". Known: ${Object.keys(targets).join(", ")}`);
    process.exit(1);
}

const readJson = (path) => JSON.parse(readFileSync(path, "utf8").replace(/^﻿/, ""));

const version = readJson(pkgPath).version;
if (!version) {
    console.error("[build-manifest] package.json has no version field");
    process.exit(1);
}

const base = readJson(basePath);
const manifest = { ...base, version, ...overrides };

writeFileSync(outPath, JSON.stringify(manifest, null, 4) + "\n");
console.log(`[build-manifest] wrote src/manifest.json for ${target} (version ${version})`);
