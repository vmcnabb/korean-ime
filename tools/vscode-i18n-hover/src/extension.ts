"use strict";

import * as fs from "node:fs";
import * as path from "node:path";
import * as vscode from "vscode";
import {
    type ChromeMessageEntry,
    findStringLiteralAtPosition,
    findTranslationKeyAtPosition,
    formatMessage,
} from "./hover-utils";
import { TypeScriptMessageKeyResolver } from "./typescript-message-key";

const messagesRelativePath = path.join("src", "_locales", "en", "messages.json");
const messagesRelativeGlob = "src/_locales/en/messages.json";
const supportedDocuments: vscode.DocumentSelector = [
    { scheme: "file", pattern: "**/*.vue" },
    { scheme: "file", pattern: "**/*.ts" },
    { scheme: "file", pattern: "**/*.tsx" },
    { scheme: "file", pattern: "**/*.js" },
    { scheme: "file", pattern: "**/*.jsx" },
    "vue",
    "typescript",
    "typescriptreact",
    "javascriptreact",
    "javascript",
];

type HoverHit = {
    key: string;
    range: vscode.Range;
};

export function activate(context: vscode.ExtensionContext): void {
    const output = vscode.window.createOutputChannel("Korean IME i18n Hover");
    const messages = new MessageCatalog(context, output);
    const messageKeyResolver = new TypeScriptMessageKeyResolver(output);
    context.subscriptions.push(output, messages, messageKeyResolver);

    const provider = vscode.languages.registerHoverProvider(supportedDocuments, {
        provideHover(document, position) {
            const hit = findHoverHit(document, position, messageKeyResolver);
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

            return new vscode.Hover(markdown, hit.range);
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

export function deactivate(): void {}

function findHoverHit(
    document: vscode.TextDocument,
    position: vscode.Position,
    messageKeyResolver: TypeScriptMessageKeyResolver
): HoverHit | undefined {
    const line = document.lineAt(position.line);
    const translationCallHit = findTranslationKeyAtPosition(line.text, position.character);
    if (translationCallHit) {
        const start = new vscode.Position(position.line, translationCallHit.start);
        const end = new vscode.Position(position.line, translationCallHit.end);
        return {
            key: translationCallHit.key,
            range: new vscode.Range(start, end),
        };
    }

    if (!isTypeScriptDocument(document) || !findStringLiteralAtPosition(line.text, position.character)) {
        return undefined;
    }

    const workspaceRoots = (vscode.workspace.workspaceFolders ?? []).map((folder) => folder.uri.fsPath);
    const semanticHit = messageKeyResolver.find(
        document.uri.fsPath,
        document.getText(),
        document.offsetAt(position),
        workspaceRoots
    );
    if (!semanticHit) {
        return undefined;
    }

    return {
        key: semanticHit.key,
        range: new vscode.Range(document.positionAt(semanticHit.start), document.positionAt(semanticHit.end)),
    };
}

function isTypeScriptDocument(document: vscode.TextDocument): boolean {
    return document.languageId === "typescript" || document.languageId === "typescriptreact";
}

class MessageCatalog implements vscode.Disposable {
    #messages: Record<string, ChromeMessageEntry> = {};
    #messagesPath: string | undefined;
    #output: vscode.OutputChannel;
    #watcher: vscode.FileSystemWatcher;

    constructor(context: vscode.ExtensionContext, output: vscode.OutputChannel) {
        this.#output = output;
        this.#load();

        this.#watcher = vscode.workspace.createFileSystemWatcher(`**/${messagesRelativeGlob}`);
        this.#watcher.onDidChange(() => this.#load(), undefined, context.subscriptions);
        this.#watcher.onDidCreate(() => this.#load(), undefined, context.subscriptions);
        this.#watcher.onDidDelete(
            () => {
                this.#messages = {};
                this.#messagesPath = undefined;
            },
            undefined,
            context.subscriptions
        );
        vscode.workspace.onDidChangeWorkspaceFolders(() => this.#load(), undefined, context.subscriptions);
    }

    get(key: string): ChromeMessageEntry | undefined {
        return this.#messages[key];
    }

    get messagesPath(): string | undefined {
        return this.#messagesPath;
    }

    get size(): number {
        return Object.keys(this.#messages).length;
    }

    dispose(): void {
        this.#watcher.dispose();
    }

    #load(): void {
        const messagesPath = findMessagesPath();
        if (!messagesPath) {
            this.#messages = {};
            this.#messagesPath = undefined;
            this.#output.appendLine("[catalog] messages file not found");
            return;
        }

        try {
            this.#messages = JSON.parse(fs.readFileSync(messagesPath, "utf8")) as Record<string, ChromeMessageEntry>;
            this.#messagesPath = messagesPath;
            this.#output.appendLine(`[catalog] loaded ${this.size} keys from ${messagesPath}`);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.#messages = {};
            this.#messagesPath = messagesPath;
            this.#output.appendLine(`[catalog] failed to read ${messagesPath}: ${message}`);
        }
    }
}

function findMessagesPath(): string | undefined {
    for (const folder of vscode.workspace.workspaceFolders ?? []) {
        const candidate = path.join(folder.uri.fsPath, messagesRelativePath);
        if (fs.existsSync(candidate)) {
            return candidate;
        }
    }

    return undefined;
}

function extensionModeName(mode: vscode.ExtensionMode): string {
    return (
        {
            [vscode.ExtensionMode.Production]: "Production",
            [vscode.ExtensionMode.Development]: "Development",
            [vscode.ExtensionMode.Test]: "Test",
        }[mode] ?? String(mode)
    );
}
