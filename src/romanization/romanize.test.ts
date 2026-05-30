import { romanize } from "./romanize";

describe("romanize", () => {
    it("should romanize standalone vowels", () => {
        expect(romanize("ㅏ")).toBe("a");
        expect(romanize("ㅓ")).toBe("eo");
        expect(romanize("ㅗ")).toBe("o");
        expect(romanize("ㅜ")).toBe("u");
        expect(romanize("ㅡ")).toBe("eu");
        expect(romanize("ㅣ")).toBe("i");
    });

    it("should romanize vowels preceded with ieung (ㅇ)", () => {
        expect(romanize("아")).toBe("a");
        expect(romanize("어")).toBe("eo");
        expect(romanize("오")).toBe("o");
        expect(romanize("우")).toBe("u");
        expect(romanize("으")).toBe("eu");
        expect(romanize("이")).toBe("i");
    });

    it("should romanize syllables without final consonants", () => {
        expect(romanize("가")).toBe("ga");
        expect(romanize("너")).toBe("neo");
        expect(romanize("모")).toBe("mo");
        expect(romanize("부")).toBe("bu");
        expect(romanize("스")).toBe("seu");
        expect(romanize("히")).toBe("hi");
    });

    it("should romanize standalone consonants", () => {
        expect(romanize("ㄱ")).toBe("g");
        expect(romanize("ㄴ")).toBe("n");
        expect(romanize("ㄹ")).toBe("r");
        expect(romanize("ㅁ")).toBe("m");
        expect(romanize("ㅂ")).toBe("b");
        expect(romanize("ㅅ")).toBe("s");
        expect(romanize("ㅇ")).toBe("ng");
        expect(romanize("ㅈ")).toBe("j");
        expect(romanize("ㅊ")).toBe("ch");
        expect(romanize("ㅋ")).toBe("k");
        expect(romanize("ㅌ")).toBe("t");
        expect(romanize("ㅍ")).toBe("p");
        expect(romanize("ㅎ")).toBe("h");
        expect(romanize("ㄷ")).toBe("d");
    });

    it("should romanize standalone digraph consonants", () => {
        expect(romanize("ㄲ")).toBe("kk");
        expect(romanize("ㄸ")).toBe("tt");
        expect(romanize("ㄳ")).toBe("ks");
        expect(romanize("ㄵ")).toBe("nj");
        expect(romanize("ㄶ")).toBe("nh");
        expect(romanize("ㄺ")).toBe("lg");
    });

    it("should romanize syllables with final consonants", () => {
        expect(romanize("각")).toBe("gak");
        expect(romanize("낙")).toBe("nak");
        expect(romanize("막")).toBe("mak");
        expect(romanize("복")).toBe("bok");
        expect(romanize("솩")).toBe("swak");
        expect(romanize("흑")).toBe("heuk");
    });

    it("should romanize the second consonant of a digraph final when the next syllable starts with a vowel", () => {
        expect(romanize("읽음")).toBe("ilgeum");
        expect(romanize("앉아")).toBe("anja");
        expect(romanize("낳아")).toBe("naha");
    });

    it("should insert a hyphen between consonants when not doing so would cause ambiguity", () => {
        expect(romanize("한글")).toBe("han-geul");
        expect(romanize("항을")).toBe("hang-eul");
    });

    it("should romanize certain consonants depending on whether or not they are followed by a vowel", () => {
        expect(romanize("닫")).toBe("dat");
        expect(romanize("닫아")).toBe("dada");
        expect(romanize("닫 아")).toBe("dat a");
        expect(romanize("랄")).toBe("ral");
        expect(romanize("랄아")).toBe("rara");
        expect(romanize("랄 아")).toBe("ral a");
    });

    it("should assimilate certain adjacent consonants", () => {
        expect(romanize("백마")).toBe("baengma");
        expect(romanize("왕십리")).toBe("wangsimni");
        expect(romanize("별내")).toBe("byeollae");
        expect(romanize("종로")).toBe("jongno");
        expect(romanize("신라")).toBe("silla");
    });

    it("should romanize only the first consonant of a digraph final when the following character is not Hangul", () => {
        expect(romanize("읽1")).toBe("ik1");
        expect(romanize("앉!")).toBe("an!");
    });

    it("should not treat a standalone ㅇ as a vowel when romanizing the preceding syllable", () => {
        expect(romanize("아ㅇ")).toBe("a-ng");
        expect(romanize("앇ㅇ")).toBe("ak-ng");
    });

    it("should romanize something for every character in the Unicode Hangul ranges.", () => {
        const range1 = [0x3131, 0x3163];
        const range2 = [0xac00, 0xd7a3];

        for (let codePoint = range1[0]; codePoint <= range1[1]; codePoint++) {
            const char = String.fromCharCode(codePoint);
            expect(romanize(char)).toBeDefined();
        }

        for (let codePoint = range2[0]; codePoint <= range2[1]; codePoint++) {
            const char = String.fromCharCode(codePoint);
            expect(romanize(char)).toBeDefined();
        }
    });

    it("should handle chicken", () => {
        expect(romanize("닭")).toBe("dak");
    });

    it("should handle non-Hangul characters gracefully", () => {
        expect(romanize("Hello, 세계!")).toBe("Hello, segye!");
        expect(romanize("aㅏbㅂkkkㅋㅋㅋkkk")).toBe("a-a-b-b-kkk-k-k-k-kkk");
    });

    describe("exceptions", () => {
        it("should assimilate certain adjacent consonants differently for certain words", () => {
            // expect(romanize("신문로")).toBe("sinmunno");
            // this sort of special case is currently not implemented as it would require a dictionary of exceptions
            // (or worse, morphological analysis to determine when to apply the special case assimilation rules).
        });

        it("should romanize names of people", () => {
            // this sort of special case is currently not implemented as it would require name detection, which is
            // nontrivial and likely to be flaky without a large database of names and their romanizations.
            // expect(romanize("박영희")).toBe("Park Young-hee");
            // expect(romanize("이순신")).toBe("Lee Soon-shin");
        });
    });
});
