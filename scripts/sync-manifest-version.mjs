// Keeps src/manifest.json's "version" in sync with package.json.
// package.json is the single source of truth; this runs as part of the build.
// Parcel requires a valid "version" in the manifest (and Chrome won't load the
// extension without one), so this guards against it ever going missing again.

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const manifestPath = resolve(root, "src/manifest.json");

const pkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8").replace(/^﻿/, ""));
const version = pkg.version;

if (!version) {
    console.error("[sync-version] package.json has no version field");
    process.exit(1);
}

const text = readFileSync(manifestPath, "utf8");
const versionLine = /^(\s*)"version"\s*:\s*"[^"]*"(,?)/m;
const manifestVersionLine = /^(\s*)("manifest_version"\s*:\s*\d+,?)/m;

let updated;
if (versionLine.test(text)) {
    // Replace the existing version, preserving indentation and trailing comma.
    updated = text.replace(versionLine, `$1"version": "${version}"$2`);
} else if (manifestVersionLine.test(text)) {
    // Insert a version line right after "manifest_version", matching its indent.
    updated = text.replace(manifestVersionLine, `$1$2\n$1"version": "${version}",`);
} else {
    console.error('[sync-version] could not find "manifest_version" to anchor the version field');
    process.exit(1);
}

if (updated === text) {
    console.log(`[sync-version] manifest version already in sync (${version})`);
} else {
    writeFileSync(manifestPath, updated);
    console.log(`[sync-version] manifest version set to ${version}`);
}
