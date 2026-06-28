import {
    commitHanjaCandidate,
    getHanjaConversionContext,
    isHanjaReadingCharacter,
    matchedTextRange,
} from "./hanja-converter";
import { CompositionAdapter } from "../composition-adapters/composition-adapter";
import { KeyCode } from "../../keyboard/korean-keyboard-map";
import { HanjaCandidate } from "./hanja-candidate";

const hanCandidates: readonly HanjaCandidate[] = [
    { hanja: "韓國", korean: "대한민국" },
    { hanja: "寒國", korean: "" },
];

function fakeAdapter(
    overrides: Partial<{
        supportsMethods: jest.Mock;
        getTextBeforeCaret: jest.Mock;
        replaceTextBeforeCaret: jest.Mock;
    }> = {}
) {
    return {
        supportsMethods: jest.fn().mockReturnValue(true),
        getTextBeforeCaret: jest.fn(),
        replaceTextBeforeCaret: jest.fn().mockReturnValue(true),
        ...overrides,
    };
}

function asAdapter(fake: ReturnType<typeof fakeAdapter>): CompositionAdapter {
    return fake as unknown as CompositionAdapter;
}

describe("getHanjaConversionContext", () => {
    it("collects the complete Hangul run before the caret", () => {
        const adapter = fakeAdapter({ getTextBeforeCaret: jest.fn().mockReturnValue("hello 한국은") });

        expect(getHanjaConversionContext(asAdapter(adapter))).toEqual({ run: "한국은" });
    });

    it("includes Hangul Jamo from every configured Unicode range", () => {
        const run = "\u1100\u3131\uA960가\uD7B0";
        const adapter = fakeAdapter({ getTextBeforeCaret: jest.fn().mockReturnValue(`.${run}`) });

        expect(getHanjaConversionContext(asAdapter(adapter))).toEqual({ run });
    });

    it("does nothing when the preceding character is not Hangul", () => {
        const adapter = fakeAdapter({ getTextBeforeCaret: jest.fn().mockReturnValue("한국 ") });

        expect(getHanjaConversionContext(asAdapter(adapter))).toBeUndefined();
    });

    it("does nothing when there is no text before the caret", () => {
        const adapter = fakeAdapter({ getTextBeforeCaret: jest.fn().mockReturnValue("") });

        expect(getHanjaConversionContext(asAdapter(adapter))).toBeUndefined();
    });

    it("bails out without reading the document when range replacement is unsupported", () => {
        const adapter = fakeAdapter({ supportsMethods: jest.fn().mockReturnValue(false) });

        expect(getHanjaConversionContext(asAdapter(adapter))).toBeUndefined();
        expect(adapter.getTextBeforeCaret).not.toHaveBeenCalled();
    });
});

describe("isHanjaReadingCharacter", () => {
    it.each([
        ["Hangul Jamo", "\u1100"],
        ["Hangul Compatibility Jamo", "\u3130"],
        ["Hangul Jamo Extended-A", "\uA960"],
        ["Hangul syllable", "\uAC00"],
        ["Hangul Jamo Extended-B", "\uD7B0"],
    ])("accepts %s", (_label, character) => {
        expect(isHanjaReadingCharacter(character)).toBe(true);
    });

    it.each(["\u10ff", "\u1200", "\u3190", "\uA980", "\uD7A4", "\uD800", "A", ""])("rejects %p", (character) => {
        expect(isHanjaReadingCharacter(character)).toBe(false);
    });
});

describe("matchedTextRange", () => {
    it("expresses the match relative to the untouched text before the caret", () => {
        expect(matchedTextRange({ run: "한국중국", matchStart: 0, reading: "한국" })).toEqual({
            text: "한국",
            offset: 2,
        });
    });
});

describe("commitHanjaCandidate", () => {
    it("re-composes the whole run with only the matched portion converted", () => {
        const adapter = fakeAdapter();
        const target = { run: "한국중국", matchStart: 0, reading: "한국" };

        expect(commitHanjaCandidate(hanCandidates[0], target, asAdapter(adapter), KeyCode.Digit1)).toBe(true);
        expect(adapter.replaceTextBeforeCaret).toHaveBeenCalledWith(
            { text: "한국중국", offset: 0 },
            "韓國중국",
            KeyCode.Digit1
        );
    });

    it("carries unmatched trailing text through a non-length-preserving conversion", () => {
        const adapter = fakeAdapter();
        const target = { run: "가가와현은", matchStart: 0, reading: "가가와현" };

        commitHanjaCandidate({ hanja: "香川縣", korean: "" }, target, asAdapter(adapter), KeyCode.Enter);

        expect(adapter.replaceTextBeforeCaret).toHaveBeenCalledWith(
            { text: "가가와현은", offset: 0 },
            "香川縣은",
            KeyCode.Enter
        );
    });

    it("uses the simplified form when requested", () => {
        const adapter = fakeAdapter();
        const target = { run: "한", matchStart: 0, reading: "한" };

        commitHanjaCandidate(
            { hanja: "韓", korean: "나라 이름 한", simplified: "韩" },
            target,
            asAdapter(adapter),
            KeyCode.Digit1,
            { useSimplified: true }
        );

        expect(adapter.replaceTextBeforeCaret).toHaveBeenCalledWith({ text: "한", offset: 0 }, "韩", KeyCode.Digit1);
    });

    it("reports a stale range that the adapter refused to replace", () => {
        const adapter = fakeAdapter({ replaceTextBeforeCaret: jest.fn().mockReturnValue(false) });

        expect(
            commitHanjaCandidate(
                hanCandidates[1],
                { run: "한국", matchStart: 0, reading: "한국" },
                asAdapter(adapter),
                KeyCode.Digit2
            )
        ).toBe(false);
    });
});
