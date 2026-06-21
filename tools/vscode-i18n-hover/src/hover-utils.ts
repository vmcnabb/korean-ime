"use strict";

export type TranslationKeyHit = {
    key: string;
    start: number;
    end: number;
};

export type ChromeMessageEntry = {
    message?: unknown;
    placeholders?: Record<string, { content?: unknown }>;
};

export const defaultLocale = "en";

const translationCallPattern = /\bt\s*\(/g;
const stringLiteralPattern = /(["'])([^"']+)\1/g;

export function findTranslationKeyAtPosition(text: string, offset: number): TranslationKeyHit | undefined {
    for (const match of text.matchAll(translationCallPattern)) {
        const callStart = match.index;
        if (callStart === undefined) {
            continue;
        }

        const argsStart = callStart + match[0].length;
        const argsEnd = findClosingParen(text, argsStart);
        if (argsEnd === undefined || offset < argsStart || offset > argsEnd) {
            continue;
        }

        const args = text.slice(argsStart, argsEnd);
        for (const literalMatch of args.matchAll(stringLiteralPattern)) {
            const literalIndex = literalMatch.index;
            if (literalIndex === undefined) {
                continue;
            }

            const literalStart = argsStart + literalIndex;
            const keyStart = literalStart + 1;
            const keyEnd = keyStart + literalMatch[2].length;
            const literalEnd = keyEnd + 1;

            if (offset >= literalStart && offset <= literalEnd) {
                return {
                    key: literalMatch[2],
                    start: literalStart,
                    end: literalEnd,
                };
            }
        }
    }

    return undefined;
}

export function findStringLiteralAtPosition(text: string, offset: number): TranslationKeyHit | undefined {
    for (const match of text.matchAll(stringLiteralPattern)) {
        const literalStart = match.index;
        if (literalStart === undefined) {
            continue;
        }

        const literalEnd = literalStart + match[0].length;
        if (offset >= literalStart && offset <= literalEnd) {
            return {
                key: match[2],
                start: literalStart,
                end: literalEnd,
            };
        }
    }

    return undefined;
}

function findClosingParen(text: string, start: number): number | undefined {
    let depth = 1;
    let quote: string | undefined;

    for (let index = start; index < text.length; index++) {
        const char = text[index];

        if (quote) {
            if (char === "\\" && index + 1 < text.length) {
                index++;
            } else if (char === quote) {
                quote = undefined;
            }
            continue;
        }

        if (char === '"' || char === "'") {
            quote = char;
        } else if (char === "(") {
            depth++;
        } else if (char === ")") {
            depth--;
            if (depth === 0) {
                return index;
            }
        }
    }

    return undefined;
}

export function formatMessage(messageEntry: ChromeMessageEntry | undefined): string | undefined {
    if (!messageEntry || typeof messageEntry.message !== "string") {
        return undefined;
    }

    let message = messageEntry.message;
    for (const [name, placeholder] of Object.entries(messageEntry.placeholders ?? {})) {
        if (typeof placeholder.content === "string") {
            message = message.replaceAll(`$${name}$`, () => placeholder.content as string);
        }
    }

    return message;
}

export function getDisplayedLocales(config: unknown): string[] {
    const locales = [defaultLocale];
    const displayedLocales =
        typeof config === "object" && config !== null && "displayed_locales" in config
            ? (config as { displayed_locales?: unknown }).displayed_locales
            : undefined;

    if (!Array.isArray(displayedLocales)) {
        return locales;
    }

    for (const locale of displayedLocales) {
        const normalizedLocale = typeof locale === "string" ? locale.trim() : undefined;
        if (normalizedLocale && !locales.includes(normalizedLocale)) {
            locales.push(normalizedLocale);
        }
    }

    return locales;
}
