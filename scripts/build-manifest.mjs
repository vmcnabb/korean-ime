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
import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const basePath = resolve(root, "src/manifest.base.json");
const outPath = resolve(root, "src/manifest.json");
const pkgPath = resolve(root, "package.json");
const sourceImageDir = resolve(root, "resources/images");
const outputImageDir = resolve(root, "src/images");
const sourceVideoDir = resolve(root, "resources/videos");
const outputVideoDir = resolve(root, "src/videos");
const bundledFontFamily = "NanumMyeongjo";
const bundledFontFiles = [resolve(root, "resources/fonts/Nanum_Myeongjo/NanumMyeongjo-Bold.ttf")];
const actionIconSizes = [16, 24, 32];
const actionIconSources = {
    a: resolve(sourceImageDir, "icon_a.svg"),
    h: resolve(sourceImageDir, "icon_h.svg"),
};
// The extension's main icons (manifest `icons` key) are rendered from the same
// Hangul source SVG as the toolbar/mode icons, so everything stays in sync from a
// single asset instead of hand-exported PNGs.
const runtimeIconSource = actionIconSources.h;
const runtimeIconSizes = [48, 128];
const copiedRuntimeVideos = {
    chrome: {
        "pin-light.mp4": "chrome-lightmode-pin.mp4",
        "pin-dark.mp4": "chrome-darkmode-pin.mp4",
    },
    firefox: {
        "pin-light.mp4": "firefox-lightmode-pin.mp4",
        "pin-dark.mp4": "firefox-darkmode-pin.mp4",
    },
};
// The OSK header mode indicator inlines these icons as data URLs. It's displayed
// at modeIconDisplaySize px; we render a set of multiples so an <img srcset> can
// hand the browser a pixel-exact source for the current devicePixelRatio (covers
// both high-DPI displays and page zoom), the way the toolbar icon stays crisp via
// its multi-size set. Each size becomes an `Nx` srcset candidate (size / display).
const modeIconsModulePath = resolve(root, "src/content-script/on-screen-keyboard/mode-icons.ts");
const modeIconDisplaySize = 16;
const modeIconRenderSizes = [16, 24, 32, 48];

// Per-target overrides merged onto the base manifest.
//
// Both targets use `background.service_worker` here because Parcel's
// webextension transformer only accepts the service_worker form — it rejects
// `background.scripts`, and rejects a manifest containing both. Firefox doesn't
// support service_worker, so the Firefox build rewrites the *emitted* manifest
// afterwards (scripts/patch-firefox-manifest.mjs), swapping service_worker for
// `background.scripts` — done post-Parcel because Parcel won't pass scripts through.
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
                // 140 is where data_collection_permissions (below) is first
                // honoured on desktop, and it's the current ESR — so it's the
                // honest floor for this manifest. (storage.session, used heavily,
                // only needs 115, so it's comfortably covered.) There's no
                // installed base on older Firefox to keep the floor low for.
                strict_min_version: "140.0",
                // AMO requires a data-collection declaration. This extension
                // collects/transmits no personal data — all storage is local
                // config/state, and there are no network calls — so "none".
                // Honoured on FF desktop 140+ / Android 142+; web-ext still warns
                // about the Android gap (KEY_FIREFOX_ANDROID_UNSUPPORTED_BY_MIN_VERSION)
                // since we ship desktop-only and don't set gecko_android — that
                // warning is expected and accepted.
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

function prepareOutputVideoDir() {
    rmSync(outputVideoDir, { recursive: true, force: true });
    mkdirSync(outputVideoDir, { recursive: true });
}

function generateRuntimeIcons() {
    for (const size of runtimeIconSizes) {
        writeFileSync(resolve(outputImageDir, `icon${size}.png`), renderIconPng(runtimeIconSource, size));
    }

    console.log(`[build-manifest] wrote ${runtimeIconSizes.length} generated runtime icons`);
}

function copyRuntimeVideos() {
    let copiedCount = 0;

    for (const [outputFileName, sourceFileName] of Object.entries(copiedRuntimeVideos[target])) {
        copyFileSync(resolve(sourceVideoDir, sourceFileName), resolve(outputVideoDir, outputFileName));
        copiedCount += 1;
    }

    console.log(`[build-manifest] copied ${copiedCount} ${target} runtime videos`);
}

function renderIconPng(sourcePath, size) {
    const svg = readFileSync(sourcePath, "utf8");
    return new Resvg(svg, {
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
}

function generateActionIcons() {
    let generatedCount = 0;

    for (const [suffix, sourcePath] of Object.entries(actionIconSources)) {
        for (const size of actionIconSizes) {
            writeFileSync(resolve(outputImageDir, `icon${size}${suffix}.png`), renderIconPng(sourcePath, size));
            generatedCount += 1;
        }
    }

    console.log(`[build-manifest] wrote ${generatedCount} generated action icons`);
}

// Generates the TS module the OSK header imports for its mode indicator. Inlined
// as data URLs (not web_accessible_resources) to avoid exposing a fingerprintable
// resource, and rendered from the same SVGs/font as the toolbar icon so they match.
// Each mode exports a 1x data URL (the <img> src fallback) plus a srcset string of
// all sizes with their `Nx` descriptors, so the browser picks the pixel-exact one.
function generateModeIcons() {
    const dataUrl = (suffix, size) =>
        `data:image/png;base64,${renderIconPng(actionIconSources[suffix], size).toString("base64")}`;
    const srcset = (suffix) =>
        modeIconRenderSizes.map((size) => `${dataUrl(suffix, size)} ${size / modeIconDisplaySize}x`).join(", ");

    const moduleSource =
        "// GENERATED by scripts/build-manifest.mjs from resources/images/icon_{h,a}.svg.\n" +
        "// Do not edit by hand; regenerated on every build (and on `npm install`).\n" +
        `export const modeIconHangul = "${dataUrl("h", modeIconDisplaySize)}";\n` +
        `export const modeIconEnglish = "${dataUrl("a", modeIconDisplaySize)}";\n` +
        `export const modeIconHangulSrcset = "${srcset("h")}";\n` +
        `export const modeIconEnglishSrcset = "${srcset("a")}";\n`;

    writeFileSync(modeIconsModulePath, moduleSource);
    console.log("[build-manifest] wrote mode-icons.ts");
}

const version = readJson(pkgPath).version;
if (!version) {
    console.error("[build-manifest] package.json has no version field");
    process.exit(1);
}

const base = readJson(basePath);
const manifest = { ...base, version, ...overrides };

prepareOutputImageDir();
prepareOutputVideoDir();
generateRuntimeIcons();
copyRuntimeVideos();
generateActionIcons();
generateModeIcons();
writeFileSync(outPath, JSON.stringify(manifest, null, 4) + "\n");
console.log(`[build-manifest] wrote src/manifest.json for ${target} (version ${version})`);
