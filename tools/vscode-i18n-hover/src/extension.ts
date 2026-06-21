"use strict";

import * as fs from "node:fs";
import * as path from "node:path";
import * as vscode from "vscode";
import {
    type ChromeMessageEntry,
    defaultLocale,
    findJsonPropertyLine,
    findStringLiteralAtPosition,
    findTranslationKeyAtPosition,
    formatMessage,
    getDisplayedLocales,
} from "./hover-utils";
import { TypeScriptMessageKeyResolver } from "./typescript-message-key";

const configFileName = "i18n-hover.json";
const openMessageCommand = "koreanImeI18nHover.openMessage";
const messagesRelativeGlob = "src/_locales/*/messages.json";
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

type MessageLocation = {
    filePath: string;
    line: number;
};

type LocalizedMessage = {
    locale: string;
    location: MessageLocation;
    message: string;
};

type LocaleCatalog = {
    keyLines: Map<string, number>;
    messages: Record<string, ChromeMessageEntry>;
    messagesPath: string;
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

            const localizedMessages = messages.getMessages(hit.key);
            if (localizedMessages.length === 0) {
                return undefined;
            }

            const markdown = new vscode.MarkdownString();
            markdown.isTrusted = { enabledCommands: [openMessageCommand] };
            markdown.appendMarkdown(`**Translation key**: \`${hit.key}\`\n\n`);
            localizedMessages.forEach(({ locale, location, message }, index) => {
                if (index > 0) {
                    markdown.appendMarkdown("\n\n");
                }

                markdown.appendMarkdown(`**${locale}** [open](${createOpenMessageUri(location)}): `);
                markdown.appendText(message);
            });

            return new vscode.Hover(markdown, hit.range);
        },
    });

    context.subscriptions.push(provider);
    context.subscriptions.push(vscode.commands.registerCommand(openMessageCommand, openMessageLocation));

    context.subscriptions.push(
        vscode.commands.registerCommand("koreanImeI18nHover.showStatus", () => {
            const folders = (vscode.workspace.workspaceFolders ?? []).map((folder) => folder.uri.fsPath).join(", ");
            const status = [
                `Mode: ${extensionModeName(context.extensionMode)}`,
                `Workspace folders: ${folders || "(none)"}`,
                `Project root: ${messages.projectRoot ?? "(not found)"}`,
                `Config file: ${messages.configPath ?? "(not found)"}`,
                `Displayed locales: ${messages.displayedLocales.join(", ")}`,
                `Loaded locale files: ${messages.loadedLocaleCount}`,
                `English keys: ${messages.size}`,
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

async function openMessageLocation(filePath: unknown, line: unknown): Promise<void> {
    if (typeof filePath !== "string" || typeof line !== "number") {
        return;
    }

    const document = await vscode.workspace.openTextDocument(vscode.Uri.file(filePath));
    const safeLine = Math.max(0, Math.min(line, document.lineCount - 1));
    const range = document.lineAt(safeLine).range;
    const editor = await vscode.window.showTextDocument(document, {
        preview: false,
        selection: range,
    });
    editor.revealRange(range, vscode.TextEditorRevealType.InCenterIfOutsideViewport);
}

function createOpenMessageUri(location: MessageLocation): string {
    const args = encodeURIComponent(JSON.stringify([location.filePath, location.line]));
    return `command:${openMessageCommand}?${args}`;
}

class MessageCatalog implements vscode.Disposable {
    #catalogs = new Map<string, LocaleCatalog>();
    #configPath: string | undefined;
    #displayedLocales = [defaultLocale];
    #output: vscode.OutputChannel;
    #projectRoot: string | undefined;
    #watchers: vscode.FileSystemWatcher[];

    constructor(context: vscode.ExtensionContext, output: vscode.OutputChannel) {
        this.#output = output;
        this.#load();

        this.#watchers = [
            vscode.workspace.createFileSystemWatcher(`**/${messagesRelativeGlob}`),
            vscode.workspace.createFileSystemWatcher(`**/${configFileName}`),
        ];
        for (const watcher of this.#watchers) {
            watcher.onDidChange(() => this.#load(), undefined, context.subscriptions);
            watcher.onDidCreate(() => this.#load(), undefined, context.subscriptions);
            watcher.onDidDelete(() => this.#load(), undefined, context.subscriptions);
        }

        vscode.workspace.onDidChangeWorkspaceFolders(() => this.#load(), undefined, context.subscriptions);
    }

    getMessages(key: string): LocalizedMessage[] {
        const defaultMessage = formatMessage(this.#catalogs.get(defaultLocale)?.messages[key]);
        if (defaultMessage === undefined) {
            return [];
        }

        return this.#displayedLocales.flatMap((locale) => {
            const catalog = this.#catalogs.get(locale);
            const message = formatMessage(catalog?.messages[key]);
            if (!catalog || message === undefined) {
                return [];
            }

            return [
                {
                    locale,
                    location: {
                        filePath: catalog.messagesPath,
                        line: catalog.keyLines.get(key) ?? 0,
                    },
                    message,
                },
            ];
        });
    }

    get configPath(): string | undefined {
        return this.#configPath;
    }

    get displayedLocales(): string[] {
        return this.#displayedLocales;
    }

    get loadedLocaleCount(): number {
        return this.#catalogs.size;
    }

    get projectRoot(): string | undefined {
        return this.#projectRoot;
    }

    get size(): number {
        return Object.keys(this.#catalogs.get(defaultLocale)?.messages ?? {}).length;
    }

    dispose(): void {
        for (const watcher of this.#watchers) {
            watcher.dispose();
        }
    }

    #load(): void {
        const projectRoot = findProjectRoot();
        if (!projectRoot) {
            this.#catalogs = new Map();
            this.#configPath = undefined;
            this.#displayedLocales = [defaultLocale];
            this.#projectRoot = undefined;
            this.#output.appendLine("[catalog] project _locales folder not found");
            return;
        }

        this.#projectRoot = projectRoot;
        this.#configPath = findConfigPath(projectRoot);
        this.#displayedLocales = getDisplayedLocales(readConfig(this.#configPath, this.#output));
        this.#catalogs = new Map();

        for (const locale of this.#displayedLocales) {
            const messagesPath = getMessagesPath(projectRoot, locale);
            if (!fs.existsSync(messagesPath)) {
                this.#output.appendLine(`[catalog] messages file not found for ${locale}: ${messagesPath}`);
                continue;
            }

            this.#loadLocale(locale, messagesPath);
        }

        this.#output.appendLine(
            `[catalog] loaded ${this.loadedLocaleCount} locale file(s): ${this.#displayedLocales.join(", ")}`
        );
    }

    #loadLocale(locale: string, messagesPath: string): void {
        try {
            const text = fs.readFileSync(messagesPath, "utf8");
            const messages = JSON.parse(text) as Record<string, ChromeMessageEntry>;
            this.#catalogs.set(locale, {
                keyLines: getMessageKeyLines(text, messages),
                messages,
                messagesPath,
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.#output.appendLine(`[catalog] failed to read ${locale} messages from ${messagesPath}: ${message}`);
        }
    }
}

function findProjectRoot(): string | undefined {
    for (const folder of vscode.workspace.workspaceFolders ?? []) {
        const candidate = getMessagesPath(folder.uri.fsPath, defaultLocale);
        if (fs.existsSync(candidate)) {
            return folder.uri.fsPath;
        }
    }

    return undefined;
}

function findConfigPath(projectRoot: string): string | undefined {
    const candidate = path.join(projectRoot, configFileName);
    return fs.existsSync(candidate) ? candidate : undefined;
}

function readConfig(configPath: string | undefined, output: vscode.OutputChannel): unknown {
    if (!configPath) {
        return undefined;
    }

    try {
        return JSON.parse(fs.readFileSync(configPath, "utf8")) as { displayed_locales?: unknown };
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        output.appendLine(`[config] failed to read ${configPath}: ${message}`);
        return undefined;
    }
}

function getMessagesPath(projectRoot: string, locale: string): string {
    return path.join(projectRoot, "src", "_locales", locale, "messages.json");
}

function getMessageKeyLines(text: string, messages: Record<string, ChromeMessageEntry>): Map<string, number> {
    return new Map(
        Object.keys(messages).flatMap((key) => {
            const line = findJsonPropertyLine(text, key);
            return line === undefined ? [] : [[key, line]];
        })
    );
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
