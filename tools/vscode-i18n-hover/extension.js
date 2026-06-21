"use strict";

const fs = require("node:fs");
const path = require("node:path");
const vscode = require("vscode");
const { findTranslationKeyAtPosition, formatMessage } = require("./hover-utils");

const messagesRelativePath = path.join("src", "_locales", "en", "messages.json");
const messagesRelativeGlob = "src/_locales/en/messages.json";
const supportedDocuments = [
    { scheme: "file", pattern: "**/*.vue" },
    { scheme: "file", pattern: "**/*.ts" },
    { scheme: "file", pattern: "**/*.tsx" },
    { scheme: "file", pattern: "**/*.js" },
    { scheme: "file", pattern: "**/*.jsx" },
    "vue",
    "typescript",
    "javascript",
];

function activate(context) {
    const output = vscode.window.createOutputChannel("Korean IME i18n Hover");
    const messages = new MessageCatalog(context, output);
    context.subscriptions.push(output, messages);

    const provider = vscode.languages.registerHoverProvider(supportedDocuments, {
        provideHover(document, position) {
            const line = document.lineAt(position.line);
            const hit = findTranslationKeyAtPosition(line.text, position.character);
            if (!hit) {
                return undefined;
            }

            const entry = messages.get(hit.key);
            const message = formatMessage(entry);
            if (message === undefined) {
                return undefined;
            }

            const markdown = new vscode.MarkdownString();
            markdown.appendMarkdown(`**Translation key**: \`${hit.key}\`\n\n`);
            markdown.appendMarkdown("**en**: ");
            markdown.appendText(message);

            const start = new vscode.Position(position.line, hit.start);
            const end = new vscode.Position(position.line, hit.end);
            return new vscode.Hover(markdown, new vscode.Range(start, end));
        },
    });

    context.subscriptions.push(provider);

    context.subscriptions.push(
        vscode.commands.registerCommand("koreanImeI18nHover.showStatus", () => {
            const folders = (vscode.workspace.workspaceFolders ?? []).map((folder) => folder.uri.fsPath).join(", ");
            const status = [
                `Mode: ${extensionModeName(context.extensionMode)}`,
                `Workspace folders: ${folders || "(none)"}`,
                `Messages file: ${messages.messagesPath ?? "(not found)"}`,
                `Loaded keys: ${messages.size}`,
            ].join("\n");

            output.appendLine(status);
            output.show();
            void vscode.window.showInformationMessage(`Korean IME i18n Hover: ${messages.size} keys loaded`);
        })
    );
}

function deactivate() {}

class MessageCatalog {
    #messages = {};
    #messagesPath;
    #output;
    #watcher;

    constructor(context, output) {
        this.#output = output;
        this.#load();

        this.#watcher = vscode.workspace.createFileSystemWatcher(`**/${messagesRelativeGlob}`);
        this.#watcher.onDidChange(() => this.#load(), undefined, context.subscriptions);
        this.#watcher.onDidCreate(() => this.#load(), undefined, context.subscriptions);
        this.#watcher.onDidDelete(() => {
            this.#messages = {};
            this.#messagesPath = undefined;
        }, undefined, context.subscriptions);
        vscode.workspace.onDidChangeWorkspaceFolders(() => this.#load(), undefined, context.subscriptions);
    }

    get(key) {
        return this.#messages[key];
    }

    get messagesPath() {
        return this.#messagesPath;
    }

    get size() {
        return Object.keys(this.#messages).length;
    }

    dispose() {
        this.#watcher?.dispose();
    }

    #load() {
        const messagesPath = findMessagesPath();
        if (!messagesPath) {
            this.#messages = {};
            this.#messagesPath = undefined;
            this.#output.appendLine("[catalog] messages file not found");
            return;
        }

        try {
            this.#messages = JSON.parse(fs.readFileSync(messagesPath, "utf8"));
            this.#messagesPath = messagesPath;
            this.#output.appendLine(`[catalog] loaded ${this.size} keys from ${messagesPath}`);
        } catch (error) {
            this.#messages = {};
            this.#messagesPath = messagesPath;
            this.#output.appendLine(`[catalog] failed to read ${messagesPath}: ${error.message}`);
        }
    }
}

function findMessagesPath() {
    for (const folder of vscode.workspace.workspaceFolders ?? []) {
        const candidate = path.join(folder.uri.fsPath, messagesRelativePath);
        if (fs.existsSync(candidate)) {
            return candidate;
        }
    }

    return undefined;
}

function extensionModeName(mode) {
    return (
        {
            [vscode.ExtensionMode.Production]: "Production",
            [vscode.ExtensionMode.Development]: "Development",
            [vscode.ExtensionMode.Test]: "Test",
        }[mode] ?? String(mode)
    );
}

module.exports = {
    activate,
    deactivate,
};
