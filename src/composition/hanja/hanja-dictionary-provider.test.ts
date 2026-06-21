import { StaticHanjaDictionaryProvider } from "./hanja-dictionary-provider";

describe("StaticHanjaDictionaryProvider", () => {
    it("keeps the bootstrap Hanja fixture entries used by controller tests", async () => {
        const provider = new StaticHanjaDictionaryProvider();

        await expect(
            provider.lookup("한").then((candidates) => candidates.map((candidate) => candidate.hanja))
        ).resolves.toEqual(["韓", "寒", "恨"]);
        await expect(
            provider.lookup("안").then((candidates) => candidates.map((candidate) => candidate.hanja))
        ).resolves.toEqual(["安", "岸"]);
        await expect(provider.lookup("가")).resolves.toHaveLength(9);
        await expect(provider.lookup("나")).resolves.toHaveLength(10);
        await expect(provider.lookup("다")).resolves.toHaveLength(18);
        await expect(provider.lookup("라")).resolves.toHaveLength(19);
    });

    it("returns Korean-only candidate metadata", async () => {
        const provider = new StaticHanjaDictionaryProvider();

        await expect(provider.lookup("한").then((candidates) => candidates[0])).resolves.toEqual({
            hanja: "韓",
            korean: "나라 이름 한, 한나라 한",
        });
    });

    it("returns no candidates for an unknown reading", async () => {
        const provider = new StaticHanjaDictionaryProvider();

        await expect(provider.lookup("글")).resolves.toEqual([]);
        await expect(provider.lookup("")).resolves.toEqual([]);
    });
});
