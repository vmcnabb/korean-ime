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
