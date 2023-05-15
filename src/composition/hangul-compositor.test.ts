import { HangulCompositor } from "./hangul-compositor";

describe("HangulCompositor", () => {
    let compositor: HangulCompositor;

    beforeEach(() => {
        compositor = new HangulCompositor();
    });

    it("should construct a HangulCompositor", () => {
        expect(compositor).toBeInstanceOf(HangulCompositor);
    });

    describe("addJamo", () => {
        it("should throw error on invalid jamo input", () => {
            expect(() => {
                compositor.addJamo("X");
            }).toThrowError(new Error("X is not a valid Jamo."));

            expect(() => {
                compositor.addJamo("ZZ");
            }).toThrowError(new Error("ZZ is not a valid Jamo."));
        });

        it("should add initial jamo", () => {
            const result = compositor.addJamo("ㄱ");
            expect(result).toEqual({ started: "ㄱ" });
            expect(compositor.isCompositing()).toEqual(true);
            expect(compositor.getCurrentChar()).toEqual("ㄱ");
        });

        it("should allow initial combining into compound vowel", () => {
            compositor.addJamo("ㅗ");
            const result = compositor.addJamo("ㅏ");
            expect(result).toEqual({ updated: "ㅘ" });
            expect(compositor.isCompositing()).toEqual(true);
            expect(compositor.getCurrentChar()).toEqual("ㅘ");
        });

        it("should allow medial combining into compound vowel", () => {
            compositor.addJamo("ㄱ");
            compositor.addJamo("ㅗ");
            const result = compositor.addJamo("ㅏ");
            expect(result).toEqual({ updated: "과" });
            expect(compositor.isCompositing()).toEqual(true);
            expect(compositor.getCurrentChar()).toEqual("과");
        });

        it("should add medial jamo", () => {
            compositor.addJamo("ㄱ");
            const result = compositor.addJamo("ㅏ");
            expect(result).toHaveProperty("updated");
            expect(compositor.isCompositing()).toEqual(true);
            expect(compositor.getCurrentChar()).toEqual("가");
        });

        it("should complete composition and begin new when consonant can't be combined with final consonant", () => {
            compositor.addJamo("ㄱ");
            compositor.addJamo("ㅏ");
            compositor.addJamo("ㄱ");
            const result = compositor.addJamo("ㄱ");
            expect(result).toEqual({ completed: "각", started: "ㄱ" });
            expect(compositor.isCompositing()).toEqual(true);
            expect(compositor.getCurrentChar()).toEqual("ㄱ");
        });

        it("should complete composition and begin new when final consonant is followed by vowel", () => {
            compositor.addJamo("ㄱ");
            compositor.addJamo("ㅏ");
            compositor.addJamo("ㅂ");
            const result = compositor.addJamo("ㅏ");
            expect(result).toEqual({ completed: "가", started: "바" });
            expect(compositor.isCompositing()).toEqual(true);
            expect(compositor.getCurrentChar()).toEqual("바");
        });

        it("should complete composition and begin new when initial compound consonant is followed by vowel", () => {
            compositor.addJamo("ㄱ");
            compositor.addJamo("ㅅ");
            const result = compositor.addJamo("ㅏ");
            expect(result).toEqual({ completed: "ㄱ", started: "사" });
            expect(compositor.isCompositing()).toEqual(true);
            expect(compositor.getCurrentChar()).toEqual("사");
        });

        it("should add final jamo", () => {
            compositor.addJamo("ㄱ");
            compositor.addJamo("ㅏ");
            const result = compositor.addJamo("ㅇ");
            expect(result).toHaveProperty("updated");
            expect(compositor.isCompositing()).toEqual(true);
            expect(compositor.getCurrentChar()).toEqual("강");
        });
    });

    describe("removeLastJamo", () => {
        it("should remove final jamo", () => {
            compositor.addJamo("ㄱ");
            compositor.addJamo("ㅏ");
            compositor.addJamo("ㅇ");
            const result = compositor.removeLastJamo();
            expect(result).toEqual("가");
            expect(compositor.isCompositing()).toEqual(true);
            expect(compositor.getCurrentChar()).toEqual("가");
        });

        it("should remove second vowel on medial jamo", () => {
            compositor.addJamo("ㄱ");
            compositor.addJamo("ㅗ");
            compositor.addJamo("ㅏ");
            const result = compositor.removeLastJamo();
            expect(result).toEqual("고");
            expect(compositor.isCompositing()).toEqual(true);
            expect(compositor.getCurrentChar()).toEqual("고");
        });
    });

    describe("reset", () => {
        it("should reset compositor", () => {
            compositor.addJamo("ㄱ");
            compositor.reset();
            expect(compositor.isCompositing()).toEqual(false);
        });
    });

    describe("setCharacter", () => {
        it("should set character and enter composition", () => {
            compositor.setCharacter("가");
            expect(compositor.isCompositing()).toEqual(true);
            expect(compositor.getCurrentChar()).toEqual("가");
        });
    });
});
