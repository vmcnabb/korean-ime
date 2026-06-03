// Zips a built extension into a store-ready archive. The stores expect
// manifest.json at the zip root, so this archives the *contents* of the dist
// dir, not the dir itself. Run after the matching build (the `package` /
// `package:firefox` npm scripts chain the build first).
//
// Usage: node scripts/package.mjs [target]   (target: chrome | firefox; default chrome)

import { createWriteStream, existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { once } from "node:events";
import { ZipArchive } from "archiver";

const root = process.cwd();

// Per-target dist dir and output-name suffix. Chrome keeps the original
// unsuffixed name so existing release tooling/expectations are unchanged.
const targets = {
    chrome: { distDir: "dist", suffix: "" },
    firefox: { distDir: "dist-firefox", suffix: "-firefox" },
};

const target = process.argv[2] ?? "chrome";
const config = targets[target];

if (!config) {
    console.error(`[package] unknown target "${target}". Known: ${Object.keys(targets).join(", ")}`);
    process.exit(1);
}

const distDir = resolve(root, config.distDir);

if (!existsSync(resolve(distDir, "manifest.json"))) {
    const buildCmd = target === "firefox" ? "npm run build:firefox" : "npm run build";
    console.error(`[package] ${config.distDir}/manifest.json not found — run \`${buildCmd}\` first`);
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
