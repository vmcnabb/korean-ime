import { isHangulOrJamo } from "./hangul-maps";

describe("isHangulOrJamo", () => {
    describe("Hangul syllable blocks (U+AC00–U+D7A3)", () => {
        it("should return true for the first syllable block (U+AC00 가)", () => {
            expect(isHangulOrJamo("\uAC00")).toBe(true);
        });

        it("should return true for the last syllable block (U+D7A3 힣)", () => {
            expect(isHangulOrJamo("\uD7A3")).toBe(true);
        });

        it("should return true for a mid-range syllable block", () => {
            expect(isHangulOrJamo("강")).toBe(true);
        });

        it("should return false for the code point just below U+AC00", () => {
            expect(isHangulOrJamo("\uABFF")).toBe(false);
        });

        it("should return false for the code point just above U+D7A3", () => {
            expect(isHangulOrJamo("\uD7A4")).toBe(false);
        });
    });

    describe("Hangul compatibility jamo (U+3131–U+318E)", () => {
        it("should return true for the first jamo (U+3131 ㄱ)", () => {
            expect(isHangulOrJamo("\u3131")).toBe(true);
        });

        it("should return true for the last jamo (U+318E ㆎ)", () => {
            expect(isHangulOrJamo("\u318E")).toBe(true);
        });

        it("should return true for a mid-range jamo", () => {
            expect(isHangulOrJamo("ㅏ")).toBe(true);
        });

        it("should return false for the code point just below U+3131", () => {
            expect(isHangulOrJamo("\u3130")).toBe(false);
        });

        it("should return false for the code point just above U+318E", () => {
            expect(isHangulOrJamo("\u318F")).toBe(false);
        });
    });

    describe("non-Hangul input", () => {
        it("should return false for a Latin character", () => {
            expect(isHangulOrJamo("A")).toBe(false);
        });

        it("should return false for a digit", () => {
            expect(isHangulOrJamo("1")).toBe(false);
        });

        it("should return false for an empty string", () => {
            expect(isHangulOrJamo("")).toBe(false);
        });
    });
});
