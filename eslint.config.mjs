import js from "@eslint/js";
import tseslint from "typescript-eslint";
import prettierRecommended from "eslint-plugin-prettier/recommended";
import globals from "globals";

export default tseslint.config(
    {
        ignores: [
            "dist-chrome/",
            "dist-chrome-dev/",
            "dist-firefox/",
            "obj/",
            "coverage/",
            ".parcel-cache/",
            "node_modules/",
        ],
    },
    js.configs.recommended,
    ...tseslint.configs.recommended,
    prettierRecommended,
    {
        // Project-wide rules (not environment-specific).
        rules: {
            "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
        },
    },
    {
        // Extension code runs in the browser. Scoped to src/ so these globals
        // don't leak into the Node scripts and mask real mistakes there.
        files: ["src/**"],
        languageOptions: {
            globals: {
                ...globals.browser,
            },
        },
    },
    {
        // Build/dev scripts run in Node, not the browser.
        files: ["scripts/**/*.mjs", "*.mjs"],
        languageOptions: {
            globals: {
                ...globals.node,
            },
        },
    }
);
