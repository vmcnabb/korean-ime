import { commitHanjaCandidate, getHanjaConversionTarget } from "./hanja-converter";
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
    }> = {}
) {
    return {
        supportsMethods: jest.fn().mockReturnValue(true),
        getPreviousCharacter: jest.fn(),
        deleteContentBackwards: jest.fn(),
        inputCharacter: jest.fn(),
        ...overrides,
    };
}

function asAdapter(fake: ReturnType<typeof fakeAdapter>): CompositionAdapter {
    return fake as unknown as CompositionAdapter;
}

describe("getHanjaConversionTarget", () => {
    describe("after a committed syllable", () => {
        it("returns the reading for the preceding syllable", () => {
            const adapter = fakeAdapter({ getPreviousCharacter: jest.fn().mockReturnValue("한") });

            expect(getHanjaConversionTarget(asAdapter(adapter))).toEqual({
                kind: "previous-character",
                reading: "한",
            });
            expect(adapter.deleteContentBackwards).not.toHaveBeenCalled();
            expect(adapter.inputCharacter).not.toHaveBeenCalled();
        });

        it("does nothing when the preceding character is not a Hangul syllable", () => {
            const adapter = fakeAdapter({ getPreviousCharacter: jest.fn().mockReturnValue("a") });

            expect(getHanjaConversionTarget(asAdapter(adapter))).toBeUndefined();
            expect(adapter.deleteContentBackwards).not.toHaveBeenCalled();
            expect(adapter.inputCharacter).not.toHaveBeenCalled();
        });

        it("does nothing when there is no preceding character", () => {
            const adapter = fakeAdapter({ getPreviousCharacter: jest.fn().mockReturnValue(undefined) });

            expect(getHanjaConversionTarget(asAdapter(adapter))).toBeUndefined();
            expect(adapter.inputCharacter).not.toHaveBeenCalled();
        });

        it("bails out (without reading the document) on an adapter that can't replace the previous char", () => {
            const adapter = fakeAdapter({ supportsMethods: jest.fn().mockReturnValue(false) });

            expect(getHanjaConversionTarget(asAdapter(adapter))).toBeUndefined();
            expect(adapter.getPreviousCharacter).not.toHaveBeenCalled();
        });
    });
});

describe("commitHanjaCandidate", () => {
    it("replaces the preceding syllable with the selected candidate", () => {
        const adapter = fakeAdapter({ getPreviousCharacter: jest.fn().mockReturnValue("한") });

        commitHanjaCandidate(hanCandidates[2], asAdapter(adapter), KeyCode.Digit3);

        expect(adapter.deleteContentBackwards).toHaveBeenCalled();
        expect(adapter.inputCharacter).toHaveBeenCalledWith("恨", KeyCode.Digit3);
    });

    it("replaces the preceding syllable with the simplified form when requested", () => {
        const adapter = fakeAdapter({ getPreviousCharacter: jest.fn().mockReturnValue("한") });

        commitHanjaCandidate(
            { hanja: "韓", korean: "나라 이름 한, 한나라 한", simplified: "韩" },
            asAdapter(adapter),
            KeyCode.Digit1,
            { useSimplified: true }
        );

        expect(adapter.deleteContentBackwards).toHaveBeenCalled();
        expect(adapter.inputCharacter).toHaveBeenCalledWith("韩", KeyCode.Digit1);
    });

    it("falls back to Hanja when simplified selection is requested but unavailable", () => {
        const adapter = fakeAdapter({ getPreviousCharacter: jest.fn().mockReturnValue("한") });

        commitHanjaCandidate(hanCandidates[1], asAdapter(adapter), KeyCode.Digit2, { useSimplified: true });

        expect(adapter.deleteContentBackwards).toHaveBeenCalled();
        expect(adapter.inputCharacter).toHaveBeenCalledWith("寒", KeyCode.Digit2);
    });
});
