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

    it("finds the hovered branch inside a ternary t() argument", () => {
        const line = 'const label = t(isMac ? "gettingStarted_notice_mac" : "gettingStarted_notice");';

        assert.deepEqual(findTranslationKeyAtPosition(line, line.indexOf("notice_mac")), {
            key: "gettingStarted_notice_mac",
            start: 24,
            end: 51,
        });
        assert.deepEqual(findTranslationKeyAtPosition(line, line.lastIndexOf("gettingStarted_notice")), {
            key: "gettingStarted_notice",
            start: 54,
            end: 77,
        });
    });

    it("handles nested parentheses in a t() argument expression", () => {
        const line = 'const label = t(getChoice("mac") ? "gettingStarted_notice_mac" : "gettingStarted_notice");';

        assert.deepEqual(findTranslationKeyAtPosition(line, line.indexOf("notice_mac")), {
            key: "gettingStarted_notice_mac",
            start: 35,
            end: 62,
        });
    });

    it("returns undefined when hovering non-string parts of a t() expression", () => {
        const line = 'const label = t(isMac ? "gettingStarted_notice_mac" : "gettingStarted_notice");';

        assert.equal(findTranslationKeyAtPosition(line, line.indexOf("isMac")), undefined);
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
