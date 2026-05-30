import js from "@eslint/js";
import tseslint from "typescript-eslint";
import prettierRecommended from "eslint-plugin-prettier/recommended";
import globals from "globals";

export default tseslint.config(
    {
        ignores: [
            "dist/",
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
        languageOptions: {
            globals: {
                ...globals.browser,
            },
        },
        rules: {
            "@typescript-eslint/no-unused-vars": [
                "error",
                { argsIgnorePattern: "^_" },
            ],
        },
    }
);
