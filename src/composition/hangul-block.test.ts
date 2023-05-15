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
        it("should convert a full HangulBlock to a single character string", () => {
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

        it("should handle a HangulBlock with only a compound vowel", () => {
            const block = new HangulBlock("ㅗㅏ");
            expect(block.toChar()).toEqual("ㅘ");
        });

        it("should handle a HangulBlock with only a compound consonant", () => {
            const block = new HangulBlock("ㄱㅅ");
            expect(block.toChar()).toEqual("ㄳ");
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

        it("should convert a character with only a compound vowel to a HangulBlock", () => {
            const block = HangulBlock.fromChar("ㅘ");
            expect(block).toBeInstanceOf(HangulBlock);
            expect(block.initial).toEqual("ㅗㅏ");
            expect(block.medial).toEqual("");
            expect(block.final).toEqual("");
        });

        it("should convert a character with only a compound consonant to a HangulBlock", () => {
            const block = HangulBlock.fromChar("ㄳ");
            expect(block).toBeInstanceOf(HangulBlock);
            expect(block.initial).toEqual("ㄱㅅ");
            expect(block.medial).toEqual("");
            expect(block.final).toEqual("");
        });
    });
});
