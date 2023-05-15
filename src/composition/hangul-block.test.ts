import { HangulBlock } from "./hangul-block";

describe("HangulBlock", () => {
    it("should construct a HangulBlock", () => {
        const block = new HangulBlock("ㄱ", "ㅏ", "ㅇ");
        expect(block).toBeInstanceOf(HangulBlock);
        expect(block.initial).toEqual("ㄱ");
        expect(block.medial).toEqual("ㅏ");
        expect(block.final).toEqual("ㅇ");
    });

    describe("toChar", () => {
        it("should convert a HangulBlock to a single character string", () => {
            const block = new HangulBlock("ㄱ", "ㅏ", "ㅇ");
            expect(block.toChar()).toEqual("강");
        });

        it("should handle a HangulBlock with only an initial consonant", () => {
            const block = new HangulBlock("ㄱ");
            expect(block.toChar()).toEqual("ㄱ");
        });

        it("should handle a HangulBlock with only an initial vowel", () => {
            const block = new HangulBlock("ㅏ");
            expect(block.toChar()).toEqual("ㅏ");
        });
    });

    describe("fromChar", () => {
        it("should convert a character to a HangulBlock", () => {
            const block = HangulBlock.fromChar("강");
            expect(block).toBeInstanceOf(HangulBlock);
            expect(block.initial).toEqual("ㄱ");
            expect(block.medial).toEqual("ㅏ");
            expect(block.final).toEqual("ㅇ");
        });

        it("should convert a character with only an initial vowel to a HangulBlock", () => {
            const block = HangulBlock.fromChar("ㅏ");
            expect(block).toBeInstanceOf(HangulBlock);
            expect(block.initial).toEqual("ㅏ");
            expect(block.medial).toEqual("");
            expect(block.final).toEqual("");
        });

        it("should convert a character with only an initial consonant to a HangulBlock", () => {
            const block = HangulBlock.fromChar("ㄱ");
            expect(block).toBeInstanceOf(HangulBlock);
            expect(block.initial).toEqual("ㄱ");
            expect(block.medial).toEqual("");
            expect(block.final).toEqual("");
        });
    });
});
