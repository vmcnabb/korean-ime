"use strict";

const translationCallPattern = /\bt\s*\(/g;
const stringLiteralPattern = /(["'])([^"']+)\1/g;

function findTranslationKeyAtPosition(text, offset) {
    for (const match of text.matchAll(translationCallPattern)) {
        const callStart = match.index;
        const argsStart = callStart + match[0].length;
        const argsEnd = findClosingParen(text, argsStart);
        if (argsEnd === undefined || offset < argsStart || offset > argsEnd) {
            continue;
        }

        const args = text.slice(argsStart, argsEnd);
        for (const literalMatch of args.matchAll(stringLiteralPattern)) {
            const literalStart = argsStart + literalMatch.index;
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

function findStringLiteralAtPosition(text, offset) {
    for (const match of text.matchAll(stringLiteralPattern)) {
        const literalStart = match.index;
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

function findClosingParen(text, start) {
    let depth = 1;
    let quote;

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

function formatMessage(messageEntry) {
    if (!messageEntry || typeof messageEntry.message !== "string") {
        return undefined;
    }

    let message = messageEntry.message;
    for (const [name, placeholder] of Object.entries(messageEntry.placeholders ?? {})) {
        if (typeof placeholder.content === "string") {
            message = message.replaceAll(`$${name}$`, () => placeholder.content);
        }
    }

    return message;
}

module.exports = {
    findStringLiteralAtPosition,
    findTranslationKeyAtPosition,
    formatMessage,
};
