"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { describe, it } = require("node:test");
const ts = require("typescript");
const { findContextualMessageKeyAtOffset } = require("../typescript-message-key");

describe("findContextualMessageKeyAtOffset", () => {
    it("finds string literals contextually typed as MessageKey", () => {
        const project = createProject({
            "src/i18n.ts": 'export type MessageKey = "keyboard_close" | "options_title";\n',
            "src/example.ts": [
                'import type { MessageKey } from "./i18n";',
                "",
                "type Item = {",
                "    tooltipResourceKey: MessageKey;",
                "    label: string;",
                "};",
                "",
                "const item: Item = {",
                '    tooltipResourceKey: "keyboard_close",',
                '    label: "keyboard_close",',
                "};",
                "",
                "declare function showMessage(key: MessageKey): void;",
                'showMessage("options_title");',
                "",
            ].join("\n"),
        });

        const examplePath = path.join(project.root, "src", "example.ts");
        const text = fs.readFileSync(examplePath, "utf8");

        assert.deepEqual(find(project, examplePath, text, text.indexOf("keyboard_close")), {
            key: "keyboard_close",
            start: text.indexOf('"keyboard_close"'),
            end: text.indexOf('"keyboard_close"') + '"keyboard_close"'.length,
        });

        assert.deepEqual(find(project, examplePath, text, text.indexOf("options_title")), {
            key: "options_title",
            start: text.indexOf('"options_title"'),
            end: text.indexOf('"options_title"') + '"options_title"'.length,
        });
    });

    it("ignores valid-looking keys that are only contextually typed as string", () => {
        const project = createProject({
            "src/i18n.ts": 'export type MessageKey = "keyboard_close";\n',
            "src/example.ts": [
                'import type { MessageKey } from "./i18n";',
                "",
                "const item: { label: string; tooltipResourceKey: MessageKey } = {",
                '    label: "keyboard_close",',
                '    tooltipResourceKey: "keyboard_close",',
                "};",
                "",
            ].join("\n"),
        });

        const examplePath = path.join(project.root, "src", "example.ts");
        const text = fs.readFileSync(examplePath, "utf8");

        assert.equal(find(project, examplePath, text, text.indexOf("keyboard_close")), undefined);
    });

    it("handles optional MessageKey properties", () => {
        const project = createProject({
            "src/i18n.ts": 'export type MessageKey = "keyboard_close" | "options_title";\n',
            "src/example.ts": [
                'import type { MessageKey } from "./i18n";',
                "",
                "const item: { tooltipResourceKey?: MessageKey } = {",
                '    tooltipResourceKey: "keyboard_close",',
                "};",
                "",
            ].join("\n"),
        });

        const examplePath = path.join(project.root, "src", "example.ts");
        const text = fs.readFileSync(examplePath, "utf8");

        assert.equal(find(project, examplePath, text, text.indexOf("keyboard_close")).key, "keyboard_close");
    });
});

function find(project, fileName, text, offset) {
    return findContextualMessageKeyAtOffset({
        ts,
        configPath: path.join(project.root, "tsconfig.json"),
        fileName,
        text,
        offset,
    });
}

function createProject(files) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "korean-ime-i18n-hover-"));
    fs.mkdirSync(path.join(root, "src"));
    fs.writeFileSync(
        path.join(root, "tsconfig.json"),
        JSON.stringify({
            compilerOptions: {
                module: "ESNext",
                moduleResolution: "node",
                strict: true,
                target: "ESNext",
            },
            include: ["src"],
        })
    );

    for (const [relativePath, contents] of Object.entries(files)) {
        fs.writeFileSync(path.join(root, relativePath), contents);
    }

    return { root };
}
