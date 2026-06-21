import { commitHanjaCandidate, getHanjaConversionTarget } from "./hanja-converter";
import { HangulCompositor } from "../hangul-compositor";
import { CompositionAdapter } from "../composition-adapters/composition-adapter";
import { KeyCode } from "../../keyboard/korean-keyboard-map";
import { lookUpHanja } from "./hanja-dictionary";

// A minimal stand-in for the bits of the adapter the converter touches. supportsMethods
// defaults to true (the input/contenteditable/CKEditor adapters all support these).
function fakeAdapter(
    overrides: Partial<{
        supportsMethods: jest.Mock;
        getPreviousCharacter: jest.Mock;
        deleteContentBackwards: jest.Mock;
        inputCharacter: jest.Mock;
        endComposition: jest.Mock;
    }> = {}
) {
    return {
        supportsMethods: jest.fn().mockReturnValue(true),
        getPreviousCharacter: jest.fn(),
        deleteContentBackwards: jest.fn(),
        inputCharacter: jest.fn(),
        endComposition: jest.fn(),
        ...overrides,
    };
}

function asAdapter(fake: ReturnType<typeof fakeAdapter>): CompositionAdapter {
    return fake as unknown as CompositionAdapter;
}

describe("getHanjaConversionTarget", () => {
    const hanCandidates = lookUpHanja("한");

    describe("mid-composition", () => {
        it("returns candidates for the in-progress block", () => {
            const compositor = new HangulCompositor();
            compositor.setCharacter("한");
            const adapter = fakeAdapter();

            expect(getHanjaConversionTarget(compositor, asAdapter(adapter))).toEqual({
                kind: "composition",
                reading: "한",
                candidates: hanCandidates,
            });
            expect(adapter.endComposition).not.toHaveBeenCalled();
            expect(compositor.isCompositing()).toBe(true);
        });

        it("leaves an unknown composing block untouched and reports no target", () => {
            const compositor = new HangulCompositor();
            compositor.setCharacter("글"); // not in the dictionary
            const adapter = fakeAdapter();

            expect(getHanjaConversionTarget(compositor, asAdapter(adapter))).toBeUndefined();
            expect(adapter.endComposition).not.toHaveBeenCalled();
            expect(compositor.isCompositing()).toBe(true); // composition preserved
        });
    });

    describe("after a committed syllable", () => {
        it("returns candidates for the preceding syllable", () => {
            const adapter = fakeAdapter({ getPreviousCharacter: jest.fn().mockReturnValue("한") });

            expect(getHanjaConversionTarget(new HangulCompositor(), asAdapter(adapter))).toEqual({
                kind: "previous-character",
                reading: "한",
                candidates: hanCandidates,
            });
            expect(adapter.deleteContentBackwards).not.toHaveBeenCalled();
            expect(adapter.inputCharacter).not.toHaveBeenCalled();
        });

        it("does nothing when the preceding syllable isn't in the dictionary", () => {
            const adapter = fakeAdapter({ getPreviousCharacter: jest.fn().mockReturnValue("글") });

            expect(getHanjaConversionTarget(new HangulCompositor(), asAdapter(adapter))).toBeUndefined();
            expect(adapter.deleteContentBackwards).not.toHaveBeenCalled();
            expect(adapter.inputCharacter).not.toHaveBeenCalled();
        });

        it("does nothing when there is no preceding character", () => {
            const adapter = fakeAdapter({ getPreviousCharacter: jest.fn().mockReturnValue(undefined) });

            expect(getHanjaConversionTarget(new HangulCompositor(), asAdapter(adapter))).toBeUndefined();
            expect(adapter.inputCharacter).not.toHaveBeenCalled();
        });

        it("bails out (without reading the document) on an adapter that can't replace the previous char", () => {
            const adapter = fakeAdapter({ supportsMethods: jest.fn().mockReturnValue(false) });

            expect(getHanjaConversionTarget(new HangulCompositor(), asAdapter(adapter))).toBeUndefined();
            expect(adapter.getPreviousCharacter).not.toHaveBeenCalled();
        });
    });
});

describe("commitHanjaCandidate", () => {
    const hanCandidates = lookUpHanja("한");

    it("commits a selected candidate in place of the in-progress block and clears composition", () => {
        const compositor = new HangulCompositor();
        compositor.setCharacter("한");
        const adapter = fakeAdapter();

        commitHanjaCandidate(
            { kind: "composition", reading: "한", candidates: hanCandidates },
            hanCandidates[1],
            compositor,
            asAdapter(adapter),
            KeyCode.Digit2
        );

        expect(adapter.endComposition).toHaveBeenCalledWith("寒");
        expect(compositor.isCompositing()).toBe(false);
    });

    it("replaces the preceding syllable with the selected candidate", () => {
        const adapter = fakeAdapter({ getPreviousCharacter: jest.fn().mockReturnValue("한") });

        commitHanjaCandidate(
            { kind: "previous-character", reading: "한", candidates: hanCandidates },
            hanCandidates[2],
            new HangulCompositor(),
            asAdapter(adapter),
            KeyCode.Digit3
        );

        expect(adapter.deleteContentBackwards).toHaveBeenCalled();
        expect(adapter.inputCharacter).toHaveBeenCalledWith("恨", KeyCode.Digit3);
    });
});
