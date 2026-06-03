// Zips a built extension into a store-ready archive. The stores expect
// manifest.json at the zip root, so this archives the *contents* of the dist
// dir, not the dir itself. Run after the matching build (the `package:chrome` /
// `package:firefox` npm scripts chain the build first).
//
// Usage: node scripts/package.mjs <chrome|firefox>   (target is required)

import { createWriteStream, existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { once } from "node:events";
import { ZipArchive } from "archiver";

const root = process.cwd();

// Per-target dist dir, output-name suffix, and the build script that fills the
// dist dir. Both targets carry an explicit browser suffix — there's no implicit
// default target.
const targets = {
    chrome: { distDir: "dist-chrome", suffix: "-chrome", buildCmd: "npm run build:chrome" },
    firefox: { distDir: "dist-firefox", suffix: "-firefox", buildCmd: "npm run build:firefox" },
};

const target = process.argv[2];
const config = targets[target];

if (!config) {
    console.error(`[package] target required: ${Object.keys(targets).join(" | ")} (got "${target ?? ""}")`);
    process.exit(1);
}

const distDir = resolve(root, config.distDir);

if (!existsSync(resolve(distDir, "manifest.json"))) {
    console.error(`[package] ${config.distDir}/manifest.json not found — run \`${config.buildCmd}\` first`);
    process.exit(1);
}

const pkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
const outName = `korean-ime-${pkg.version}${config.suffix}.zip`;
const output = createWriteStream(resolve(root, outName));
const archive = new ZipArchive({ zlib: { level: 9 } });

archive.on("warning", (err) => {
    if (err.code === "ENOENT") console.warn(err);
    else throw err;
});
archive.on("error", (err) => {
    throw err;
});

archive.pipe(output);
archive.directory(distDir, false); // false => contents at the zip root

const closed = once(output, "close");
await archive.finalize();
await closed;

console.log(`[package] wrote ${outName} (${archive.pointer()} bytes)`);
