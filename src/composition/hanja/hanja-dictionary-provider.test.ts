import { StaticHanjaDictionaryProvider } from "./hanja-dictionary-provider";

describe("StaticHanjaDictionaryProvider", () => {
    it("keeps the bootstrap Hanja fixture entries used by controller tests", async () => {
        const provider = new StaticHanjaDictionaryProvider();

        await expect(
            provider.lookup("한").then((match) => match?.candidates.map((candidate) => candidate.hanja))
        ).resolves.toEqual(["韓", "寒", "恨"]);
        await expect(
            provider.lookup("안").then((match) => match?.candidates.map((candidate) => candidate.hanja))
        ).resolves.toEqual(["安", "岸"]);
        await expect(provider.lookup("가").then((match) => match?.candidates)).resolves.toHaveLength(9);
        await expect(provider.lookup("나").then((match) => match?.candidates)).resolves.toHaveLength(10);
        await expect(provider.lookup("다").then((match) => match?.candidates)).resolves.toHaveLength(18);
        await expect(provider.lookup("라").then((match) => match?.candidates)).resolves.toHaveLength(19);
    });

    it("returns Korean-only candidate metadata", async () => {
        const provider = new StaticHanjaDictionaryProvider();

        await expect(provider.lookup("한").then((match) => match?.candidates[0])).resolves.toEqual({
            hanja: "韓",
            korean: "나라 이름 한, 한나라 한",
        });
    });

    it("returns no candidates for an unknown reading", async () => {
        const provider = new StaticHanjaDictionaryProvider();

        await expect(provider.lookup("글")).resolves.toBeUndefined();
        await expect(provider.lookup("")).resolves.toBeUndefined();
    });

    it("finds the longest match at the leftmost start position", async () => {
        const provider = new StaticHanjaDictionaryProvider(
            new Map([
                ["한", [{ hanja: "韓", korean: "" }]],
                ["한국", [{ hanja: "韓國", korean: "대한민국" }]],
                ["중국", [{ hanja: "中國", korean: "" }]],
            ])
        );

        await expect(provider.lookup("한국중국")).resolves.toEqual({
            start: 0,
            length: 2,
            reading: "한국",
            candidates: [{ hanja: "韓國", korean: "대한민국" }],
        });
    });

    it("advances to a later start when no reading begins at the left edge", async () => {
        const provider = new StaticHanjaDictionaryProvider(
            new Map([["한국", [{ hanja: "韓國", korean: "대한민국" }]]])
        );

        await expect(provider.lookup("글한국")).resolves.toMatchObject({
            start: 1,
            length: 2,
            reading: "한국",
        });
    });
});
