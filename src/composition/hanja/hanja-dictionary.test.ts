import { lookUpHanja } from "./hanja-dictionary";

describe("lookUpHanja (step-1 bootstrap dictionary)", () => {
    it("returns the candidate list for the one known reading", () => {
        expect(lookUpHanja("한")).toEqual(["韓"]);
    });

    it("returns an empty list for a reading that isn't in the dictionary", () => {
        expect(lookUpHanja("글")).toEqual([]);
        expect(lookUpHanja("")).toEqual([]);
    });
});
