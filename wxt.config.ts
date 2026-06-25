import { defineConfig } from "wxt";

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
    // Open the localhost test page (served by scripts/dev.mjs) in the dev
    // browser on launch, so the content script injects into a real http page.
    webExt: {
        startUrls: ["http://localhost:3344/"],
    },
    // Parcel auto-polyfilled `process` and inlined `process.env.*`. Vite handles
    // `process.env.NODE_ENV` natively (dev + build), but custom keys are only
    // statically replaced at *build* time — so define KIME_ENABLE_HANJA here so
    // production folds it to a constant and tree-shakes the gated Hanja UI. In
    // dev, Vite leaves it as a runtime read, which the process shim covers (see
    // src/platform/process-shim.ts). KIME_ENABLE_HANJA is read from the build env.
    vite: () => ({
        define: {
            "process.env.KIME_ENABLE_HANJA": JSON.stringify(process.env.KIME_ENABLE_HANJA ?? "false"),
        },
    }),
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
