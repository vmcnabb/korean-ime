// Generates src/manifest.json from src/manifest.base.json for a given browser
// target, and regenerates runtime images in src/images from source assets in
// resources/images. The generated files are build artifacts (gitignored) — the
// base manifest, the source assets, package.json's version, and the per-target
// overrides below are the real source of truth.
//
// Parcel's webextension transformer requires the manifest to be named exactly
// `manifest.json` and to sit beside the assets it references (so relative paths
// like images/ and _locales/ resolve), which is why we generate in place at
// src/manifest.json rather than a sibling name or subdirectory.
//
// Usage: node scripts/build-manifest.mjs <target>      (default: chrome)

import { Resvg } from "@resvg/resvg-js";
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const basePath = resolve(root, "src/manifest.base.json");
const outPath = resolve(root, "src/manifest.json");
const pkgPath = resolve(root, "package.json");
const sourceImageDir = resolve(root, "resources/images");
const outputImageDir = resolve(root, "src/images");
const bundledFontFamily = "NanumMyeongjo";
const bundledFontFiles = [resolve(root, "resources/fonts/Nanum_Myeongjo/NanumMyeongjo-Bold.ttf")];
const actionIconSizes = [16, 24, 32];
const actionIconSources = {
    a: resolve(sourceImageDir, "icon_a.svg"),
    h: resolve(sourceImageDir, "icon_h.svg"),
};
const copiedRuntimeImages = ["icon48.png", "icon128.png"];

// Per-target overrides merged onto the base manifest.
//
// Both targets use `background.service_worker` here because Parcel's
// webextension transformer only accepts the service_worker form — it rejects
// `background.scripts`, and rejects a manifest containing both. Firefox doesn't
// support service_worker, so the Firefox build adds `background.scripts` to the
// *emitted* manifest afterwards (scripts/patch-firefox-manifest.mjs) — the
// dual-key form Mozilla recommends, assembled post-Parcel because Parcel won't
// pass it through.
const targets = {
    chrome: {
        minimum_chrome_version: "102",
        background: {
            service_worker: "service-worker/service-worker.ts",
            type: "module",
        },
    },
    firefox: {
        browser_specific_settings: {
            gecko: {
                id: "korean-ime@vmcnabb",
                // storage.session (used heavily) requires Firefox 115+.
                strict_min_version: "115.0",
                // AMO requires a data-collection declaration. This extension
                // collects/transmits no personal data — all storage is local
                // config/state, and there are no network calls — so "none".
                data_collection_permissions: { required: ["none"] },
            },
        },
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

// Strip a leading BOM (U+FEFF) if present, so JSON.parse doesn't choke on it.
const stripBom = (text) => (text.charCodeAt(0) === 0xfeff ? text.slice(1) : text);
const readJson = (path) => JSON.parse(stripBom(readFileSync(path, "utf8")));

function prepareOutputImageDir() {
    mkdirSync(outputImageDir, { recursive: true });
}

function copyRuntimeImages() {
    for (const fileName of copiedRuntimeImages) {
        copyFileSync(resolve(sourceImageDir, fileName), resolve(outputImageDir, fileName));
    }

    console.log(`[build-manifest] copied ${copiedRuntimeImages.length} runtime images`);
}

function generateActionIcons() {
    let generatedCount = 0;

    for (const [suffix, sourcePath] of Object.entries(actionIconSources)) {
        const svg = readFileSync(sourcePath, "utf8");

        for (const size of actionIconSizes) {
            const png = new Resvg(svg, {
                fitTo: { mode: "width", value: size },
                font: {
                    defaultFontFamily: bundledFontFamily,
                    fontFiles: bundledFontFiles,
                    loadSystemFonts: false,
                    serifFamily: bundledFontFamily,
                },
            })
                .render()
                .asPng();
            const outputPath = resolve(outputImageDir, `icon${size}${suffix}.png`);

            writeFileSync(outputPath, png);
            generatedCount += 1;
        }
    }

    console.log(`[build-manifest] wrote ${generatedCount} generated action icons`);
}

const version = readJson(pkgPath).version;
if (!version) {
    console.error("[build-manifest] package.json has no version field");
    process.exit(1);
}

const base = readJson(basePath);
const manifest = { ...base, version, ...overrides };

prepareOutputImageDir();
copyRuntimeImages();
generateActionIcons();
writeFileSync(outPath, JSON.stringify(manifest, null, 4) + "\n");
console.log(`[build-manifest] wrote src/manifest.json for ${target} (version ${version})`);
