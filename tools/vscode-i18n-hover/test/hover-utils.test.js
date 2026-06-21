"use strict";

const assert = require("node:assert/strict");
const { describe, it } = require("node:test");
const { findTranslationKeyAtPosition, formatMessage } = require("../hover-utils");

describe("findTranslationKeyAtPosition", () => {
    it("finds a double-quoted t() key when hovering inside the literal", () => {
        const line = '{{ t("options_title") }}';

        assert.deepEqual(findTranslationKeyAtPosition(line, line.indexOf("options")), {
            key: "options_title",
            start: 5,
            end: 20,
        });
    });

    it("finds a single-quoted t() key with whitespace", () => {
        const line = ":title=\"t( 'options_hanYong_heading' )\"";

        assert.deepEqual(findTranslationKeyAtPosition(line, line.indexOf("hanYong")), {
            key: "options_hanYong_heading",
            start: 11,
            end: 36,
        });
    });

    it("returns undefined outside a t() string literal", () => {
        const line = 'const key = "options_title";';

        assert.equal(findTranslationKeyAtPosition(line, line.indexOf("options")), undefined);
    });
});

describe("formatMessage", () => {
    it("returns a plain message", () => {
        assert.equal(formatMessage({ message: "Options" }), "Options");
    });

    it("substitutes Chrome i18n placeholders with their content", () => {
        assert.equal(
            formatMessage({
                message: "$count$ chars",
                placeholders: {
                    count: {
                        content: "$1",
                    },
                },
            }),
            "$1 chars"
        );
    });

    it("returns undefined for an unknown key entry", () => {
        assert.equal(formatMessage(undefined), undefined);
    });
});
