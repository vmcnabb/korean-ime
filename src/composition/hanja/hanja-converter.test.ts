import { commitHanjaCandidate, getHanjaConversionTarget } from "./hanja-converter";
import { HangulCompositor } from "../hangul-compositor";
import { CompositionAdapter } from "../composition-adapters/composition-adapter";
import { KeyCode } from "../../keyboard/korean-keyboard-map";
import { HanjaCandidate } from "./hanja-candidate";

const hanCandidates: readonly HanjaCandidate[] = [
    { hanja: "韓", korean: "나라 이름 한, 한나라 한" },
    { hanja: "寒", korean: "찰 한" },
    { hanja: "恨", korean: "한탄할 한, 한될 한" },
];

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
    describe("mid-composition", () => {
        it("returns the reading for the in-progress block", () => {
            const compositor = new HangulCompositor();
            compositor.setCharacter("한");
            const adapter = fakeAdapter();

            expect(getHanjaConversionTarget(compositor, asAdapter(adapter))).toEqual({
                kind: "composition",
                reading: "한",
            });
            expect(adapter.endComposition).not.toHaveBeenCalled();
            expect(compositor.isCompositing()).toBe(true);
        });

        it("leaves a non-syllable composing block untouched and reports no target", () => {
            const compositor = new HangulCompositor();
            compositor.addJamo("ㄱ");
            const adapter = fakeAdapter();

            expect(getHanjaConversionTarget(compositor, asAdapter(adapter))).toBeUndefined();
            expect(adapter.endComposition).not.toHaveBeenCalled();
            expect(compositor.isCompositing()).toBe(true); // composition preserved
        });
    });

    describe("after a committed syllable", () => {
        it("returns the reading for the preceding syllable", () => {
            const adapter = fakeAdapter({ getPreviousCharacter: jest.fn().mockReturnValue("한") });

            expect(getHanjaConversionTarget(new HangulCompositor(), asAdapter(adapter))).toEqual({
                kind: "previous-character",
                reading: "한",
            });
            expect(adapter.deleteContentBackwards).not.toHaveBeenCalled();
            expect(adapter.inputCharacter).not.toHaveBeenCalled();
        });

        it("does nothing when the preceding character is not a Hangul syllable", () => {
            const adapter = fakeAdapter({ getPreviousCharacter: jest.fn().mockReturnValue("a") });

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
    it("commits a selected candidate in place of the in-progress block and clears composition", () => {
        const compositor = new HangulCompositor();
        compositor.setCharacter("한");
        const adapter = fakeAdapter();

        commitHanjaCandidate(
            { kind: "composition", reading: "한" },
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
            { kind: "previous-character", reading: "한" },
            hanCandidates[2],
            new HangulCompositor(),
            asAdapter(adapter),
            KeyCode.Digit3
        );

        expect(adapter.deleteContentBackwards).toHaveBeenCalled();
        expect(adapter.inputCharacter).toHaveBeenCalledWith("恨", KeyCode.Digit3);
    });
});
