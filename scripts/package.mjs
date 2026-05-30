// Zips the built extension (dist/) into korean-ime-<version>.zip for the
// Chrome Web Store. The store expects manifest.json at the zip root, so this
// archives the *contents* of dist/, not the dist/ folder itself.
// Run after a build (the `package` npm script chains `build` first).

import { createWriteStream, existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { once } from "node:events";
import { ZipArchive } from "archiver";

const root = process.cwd();
const distDir = resolve(root, "dist");

if (!existsSync(resolve(distDir, "manifest.json"))) {
    console.error("[package] dist/manifest.json not found — run `npm run build` first");
    process.exit(1);
}

const pkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
const outName = `korean-ime-${pkg.version}.zip`;
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
