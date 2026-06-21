import { lookUpHanja } from "./hanja-dictionary";

describe("lookUpHanja (bootstrap dictionary)", () => {
    it("returns the ordered candidate list for known readings", () => {
        expect(lookUpHanja("한").map((candidate) => candidate.hanja)).toEqual(["韓", "寒", "恨"]);
        expect(lookUpHanja("안").map((candidate) => candidate.hanja)).toEqual(["安", "岸"]);
        expect(lookUpHanja("가")).toHaveLength(9);
        expect(lookUpHanja("나")).toHaveLength(10);
        expect(lookUpHanja("다")).toHaveLength(18);
        expect(lookUpHanja("라")).toHaveLength(19);
    });

    it("includes Korean readings, Simplified Chinese, and Pinyin for candidates", () => {
        expect(lookUpHanja("한")[0]).toEqual({
            hanja: "韓",
            korean: "나라 이름 한, 한나라 한",
            simplified: "韩",
            pinyin: "hán",
        });
        expect(lookUpHanja("한")[1]).toEqual({
            hanja: "寒",
            korean: "찰 한",
            pinyin: "hán",
        });
    });

    it("returns an empty list for a reading that isn't in the dictionary", () => {
        expect(lookUpHanja("글")).toEqual([]);
        expect(lookUpHanja("")).toEqual([]);
    });
});
