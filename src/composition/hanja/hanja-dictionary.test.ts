import { lookUpHanja } from "./hanja-dictionary";

describe("lookUpHanja (bootstrap dictionary)", () => {
    it("returns the ordered candidate list for known readings", () => {
        expect(lookUpHanja("한")).toEqual(["韓", "寒", "恨"]);
        expect(lookUpHanja("안")).toEqual(["安", "岸"]);
    });

    it("returns an empty list for a reading that isn't in the dictionary", () => {
        expect(lookUpHanja("글")).toEqual([]);
        expect(lookUpHanja("")).toEqual([]);
    });
});
