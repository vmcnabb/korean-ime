import { defineConfig } from "wxt";

// Single input for the gated Hanja feature: KIME_ENABLE_HANJA (set by
// `--enable-hanja` in dev, or `KIME_ENABLE_HANJA=true npm run build`). Mirror it
// to VITE_ENABLE_HANJA so Vite exposes it on import.meta.env for the dev process
// shim (custom defines don't fold in the dev server; VITE_* env does).
if (process.env.KIME_ENABLE_HANJA && !process.env.VITE_ENABLE_HANJA) {
    process.env.VITE_ENABLE_HANJA = process.env.KIME_ENABLE_HANJA;
}

// WXT replaces the bespoke Parcel pipeline: manifest generation
// (manifest.base.json + build-manifest.mjs), the Firefox background patch, and
// the dev launchers. The manifest below is the former manifest.base.json plus
// the per-target overrides that build-manifest.mjs used to merge.
export default defineConfig({
    srcDir: "src",
    // Keep explicit imports — this codebase imports everything by hand and the
    // tests rely on that. Auto-imports would create ambiguity with no upside.
    imports: false,
    modules: ["@wxt-dev/module-vue"],
    // Dev browser launch. Opens the localhost test page (served by
    // scripts/dev.mjs) so the content script injects into a real http page, and
    // applies the session flags dev.mjs forwards via env vars: --locale sets the
    // UI locale chrome.i18n resolves against; --dark/--light force
    // prefers-color-scheme without touching the OS theme (Chrome has no
    // --force-light-mode, so light is Firefox-only — the old launcher used CDP).
    webExt: {
        startUrls: ["http://localhost:3344/"],
        chromiumArgs: [
            ...(process.env.KIME_DEV_LOCALE ? [`--lang=${process.env.KIME_DEV_LOCALE}`] : []),
            ...(process.env.KIME_DEV_COLOR_SCHEME === "dark" ? ["--force-dark-mode"] : []),
        ],
        firefoxPref: {
            ...(process.env.KIME_DEV_LOCALE ? { "intl.locale.requested": process.env.KIME_DEV_LOCALE } : {}),
            ...(process.env.KIME_DEV_COLOR_SCHEME
                ? {
                      "ui.systemUsesDarkTheme": process.env.KIME_DEV_COLOR_SCHEME === "dark" ? 1 : 0,
                      "layout.css.prefers-color-scheme.content-override":
                          process.env.KIME_DEV_COLOR_SCHEME === "dark" ? 0 : 1,
                  }
                : {}),
        },
    },
    // Parcel auto-polyfilled `process` and inlined `process.env.*`. Vite handles
    // `process.env.NODE_ENV` natively (dev + build), but custom keys are only
    // statically replaced at *build* time — so define KIME_ENABLE_HANJA here so
    // production folds it to a constant and tree-shakes the gated Hanja UI. In
    // dev, Vite leaves it as a runtime read, which the process shim covers (see
    // src/platform/process-shim.ts). KIME_ENABLE_HANJA is read from the build env.
    vite: () => ({
        define: {
            // For production: replaces the source reads so the gated Hanja UI
            // tree-shakes. Vite doesn't apply custom process.env.* defines in the
            // dev server, so __KIME_ENABLE_HANJA__ (a plain identifier, which Vite
            // *does* replace in dev) carries the value to the process shim there.
            "process.env.KIME_ENABLE_HANJA": JSON.stringify(process.env.KIME_ENABLE_HANJA ?? "false"),
        },
    }),
    hooks: {
        // Firefox MV3 dev: WXT registers content scripts at runtime
        // (scripting.registerContentScripts, for HMR) instead of in the manifest,
        // but Firefox doesn't honour that registration in dev, so the script never
        // injects. Re-add it statically. Scoped to serve + firefox + mv3 only:
        // Chrome's runtime registration works there (re-adding would double-inject),
        // and the production build already lists content_scripts. The cost is no
        // content-script HMR in Firefox dev (a full reload picks up changes).
        "build:manifestGenerated": (wxt, manifest) => {
            const { command, browser, manifestVersion } = wxt.config;
            if (command !== "serve" || browser !== "firefox" || manifestVersion !== 3) {
                return;
            }
            manifest.content_scripts ??= [];
            manifest.content_scripts.push({
                matches: ["<all_urls>"],
                all_frames: true,
                match_about_blank: true,
                run_at: "document_idle",
                js: ["content-scripts/content.js"],
                css: ["content-scripts/content.css"],
            });
        },
    },
    manifest: ({ browser }) => ({
        name: "__MSG_extension_name__",
        short_name: "__MSG_extension_short_name__",
        description: "__MSG_extension_description__",
        default_locale: "en",
        author: "Vincent McNabb",
        permissions: ["contextMenus", "storage"],
        icons: {
            16: "/images/icon16h.png",
            48: "/images/icon48.png",
            128: "/images/icon128.png",
        },
        action: {
            default_icon: {
                16: "/images/icon16a.png",
                24: "/images/icon24a.png",
                32: "/images/icon32a.png",
            },
            default_title: "__MSG_extension_name__",
        },
        ...(browser === "firefox"
            ? {
                  browser_specific_settings: {
                      gecko: {
                          id: "korean-ime@vmcnabb",
                          strict_min_version: "140.0",
                          data_collection_permissions: { required: ["none"] },
                      },
                  },
              }
            : {
                  minimum_chrome_version: "102",
              }),
    }),
});
