import { convertHangulToHanja } from "./hanja-converter";
import { HangulCompositor } from "../hangul-compositor";
import { CompositionAdapter } from "../composition-adapters/composition-adapter";

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

describe("convertHangulToHanja", () => {
    describe("mid-composition", () => {
        it("commits the Hanja in place of the in-progress block and clears composition", () => {
            const compositor = new HangulCompositor();
            compositor.setCharacter("한");
            const adapter = fakeAdapter();

            expect(convertHangulToHanja(compositor, asAdapter(adapter))).toBe(true);
            expect(adapter.endComposition).toHaveBeenCalledWith("韓");
            expect(compositor.isCompositing()).toBe(false);
        });

        it("leaves an unknown composing block untouched and reports nothing converted", () => {
            const compositor = new HangulCompositor();
            compositor.setCharacter("글"); // not in the dictionary
            const adapter = fakeAdapter();

            expect(convertHangulToHanja(compositor, asAdapter(adapter))).toBe(false);
            expect(adapter.endComposition).not.toHaveBeenCalled();
            expect(compositor.isCompositing()).toBe(true); // composition preserved
        });
    });

    describe("after a committed syllable", () => {
        it("replaces the preceding syllable with its Hanja", () => {
            const adapter = fakeAdapter({ getPreviousCharacter: jest.fn().mockReturnValue("한") });

            expect(convertHangulToHanja(new HangulCompositor(), asAdapter(adapter))).toBe(true);
            expect(adapter.deleteContentBackwards).toHaveBeenCalled();
            expect(adapter.inputCharacter).toHaveBeenCalledWith("韓", expect.anything());
        });

        it("does nothing when the preceding syllable isn't in the dictionary", () => {
            const adapter = fakeAdapter({ getPreviousCharacter: jest.fn().mockReturnValue("글") });

            expect(convertHangulToHanja(new HangulCompositor(), asAdapter(adapter))).toBe(false);
            expect(adapter.deleteContentBackwards).not.toHaveBeenCalled();
            expect(adapter.inputCharacter).not.toHaveBeenCalled();
        });

        it("does nothing when there is no preceding character", () => {
            const adapter = fakeAdapter({ getPreviousCharacter: jest.fn().mockReturnValue(undefined) });

            expect(convertHangulToHanja(new HangulCompositor(), asAdapter(adapter))).toBe(false);
            expect(adapter.inputCharacter).not.toHaveBeenCalled();
        });

        it("bails out (without reading the document) on an adapter that can't replace the previous char", () => {
            const adapter = fakeAdapter({ supportsMethods: jest.fn().mockReturnValue(false) });

            expect(convertHangulToHanja(new HangulCompositor(), asAdapter(adapter))).toBe(false);
            expect(adapter.getPreviousCharacter).not.toHaveBeenCalled();
        });
    });
});
