"use strict";

const translationCallPattern = /\bt\s*\(\s*(["'])([^"']+)\1/g;

function findTranslationKeyAtPosition(text, offset) {
    for (const match of text.matchAll(translationCallPattern)) {
        const literalStart = match.index + match[0].indexOf(match[1]);
        const keyStart = literalStart + 1;
        const keyEnd = keyStart + match[2].length;
        const literalEnd = keyEnd + 1;

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
    findTranslationKeyAtPosition,
    formatMessage,
};
