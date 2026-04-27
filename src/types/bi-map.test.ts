import { ReadOnlyBiMap } from "./bi-map";

describe("ReadOnlyBiMap", () => {
    let map: ReadOnlyBiMap<string, string>;

    beforeEach(() => {
        map = new ReadOnlyBiMap([
            ["a", "1"],
            ["b", "2"],
            ["c", "3"],
        ]);
    });

    describe("get", () => {
        it("should return the value for a known key", () => {
            expect(map.get("a")).toBe("1");
            expect(map.get("b")).toBe("2");
        });

        it("should return undefined for an unknown key", () => {
            expect(map.get("z")).toBeUndefined();
        });
    });

    describe("has", () => {
        it("should return true for a known key", () => {
            expect(map.has("a")).toBe(true);
        });

        it("should return false for an unknown key", () => {
            expect(map.has("z")).toBe(false);
        });
    });

    describe("getReverse", () => {
        it("should return the key for a known value", () => {
            expect(map.getReverse("1")).toBe("a");
            expect(map.getReverse("2")).toBe("b");
        });

        it("should return undefined for an unknown value", () => {
            expect(map.getReverse("9")).toBeUndefined();
        });
    });

    describe("hasReverse", () => {
        it("should return true for a known value", () => {
            expect(map.hasReverse("1")).toBe(true);
        });

        it("should return false for an unknown value", () => {
            expect(map.hasReverse("9")).toBe(false);
        });
    });

    describe("construction", () => {
        it("should throw on a duplicate key", () => {
            expect(
                () =>
                    new ReadOnlyBiMap([
                        ["a", "1"],
                        ["a", "2"],
                    ])
            ).toThrow("Duplicate key: a");
        });

        it("should throw on a duplicate value", () => {
            expect(
                () =>
                    new ReadOnlyBiMap([
                        ["a", "1"],
                        ["b", "1"],
                    ])
            ).toThrow("Duplicate value: 1");
        });

        it("should construct an empty map", () => {
            const empty = new ReadOnlyBiMap<string, string>([]);
            expect(empty.has("a")).toBe(false);
            expect(empty.hasReverse("1")).toBe(false);
        });
    });
});
