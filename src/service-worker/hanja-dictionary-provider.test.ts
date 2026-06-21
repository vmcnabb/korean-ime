import { GeneratedHanjaDictionaryProvider } from "./hanja-dictionary-provider";

jest.mock("url:../hanja-dictionary/single-syllable.data", () => "single-syllable.data", { virtual: true });

function okJson(data: unknown) {
    return {
        ok: true,
        status: 200,
        json: jest.fn(async () => data),
    } as unknown as Response;
}

describe("GeneratedHanjaDictionaryProvider", () => {
    beforeEach(() => {
        globalThis.chrome = {
            runtime: {
                getURL: jest.fn((path: string) => `chrome-extension://id/${path}`),
            },
        } as unknown as typeof chrome;
    });

    afterEach(() => {
        delete (globalThis as { chrome?: typeof chrome }).chrome;
        jest.restoreAllMocks();
    });

    it("resolves the packaged dictionary asset through the runtime API", async () => {
        const fetchDictionary = jest.fn(async () =>
            okJson({ 안: [["安", "편안할 안, 어찌 안"]] })
        ) as unknown as typeof fetch;
        const provider = new GeneratedHanjaDictionaryProvider(undefined, fetchDictionary);

        await expect(provider.lookup("안")).resolves.toEqual([{ hanja: "安", korean: "편안할 안, 어찌 안" }]);
        expect(fetchDictionary).toHaveBeenCalledWith("chrome-extension://id/single-syllable.data");
    });

    it("uses the default fetch with the worker global receiver", async () => {
        const originalFetch = globalThis.fetch;
        const fetchDictionary = jest.fn(function (this: unknown) {
            expect(this).toBe(globalThis);
            return Promise.resolve(okJson({ 안: [["安", "편안할 안, 어찌 안"]] }));
        } as typeof fetch);
        globalThis.fetch = fetchDictionary as typeof fetch;

        try {
            const provider = new GeneratedHanjaDictionaryProvider();

            await expect(provider.lookup("안")).resolves.toEqual([{ hanja: "安", korean: "편안할 안, 어찌 안" }]);
            expect(fetchDictionary).toHaveBeenCalledWith("chrome-extension://id/single-syllable.data", undefined);
        } finally {
            if (originalFetch) {
                globalThis.fetch = originalFetch;
            } else {
                delete (globalThis as { fetch?: typeof fetch }).fetch;
            }
        }
    });

    it("maps compact generated dictionary rows to Hanja candidates", async () => {
        const fetchDictionary = jest.fn(async () =>
            okJson({
                한: [
                    ["韓", "나라 이름 한, 한나라 한"],
                    ["寒", "찰 한"],
                ],
            })
        ) as unknown as typeof fetch;
        const provider = new GeneratedHanjaDictionaryProvider(
            "chrome-extension://id/single-syllable.json",
            fetchDictionary
        );

        await expect(provider.lookup("한")).resolves.toEqual([
            { hanja: "韓", korean: "나라 이름 한, 한나라 한" },
            { hanja: "寒", korean: "찰 한" },
        ]);
    });

    it("returns no candidates for an unknown reading", async () => {
        const fetchDictionary = jest.fn(async () =>
            okJson({ 한: [["韓", "나라 이름 한, 한나라 한"]] })
        ) as unknown as typeof fetch;
        const provider = new GeneratedHanjaDictionaryProvider(
            "chrome-extension://id/single-syllable.json",
            fetchDictionary
        );

        await expect(provider.lookup("글")).resolves.toEqual([]);
    });

    it("fetches the generated dictionary once and shares the loaded data", async () => {
        let resolveJson!: (data: unknown) => void;
        const fetchDictionary = jest.fn(
            async () =>
                ({
                    ok: true,
                    status: 200,
                    json: jest.fn(
                        () =>
                            new Promise((resolve) => {
                                resolveJson = resolve;
                            })
                    ),
                }) as unknown as Response
        ) as unknown as typeof fetch;
        const provider = new GeneratedHanjaDictionaryProvider(
            "chrome-extension://id/single-syllable.json",
            fetchDictionary
        );

        const hanLookup = provider.lookup("한");
        const anLookup = provider.lookup("안");
        await Promise.resolve();
        resolveJson({
            한: [["韓", "나라 이름 한, 한나라 한"]],
            안: [["安", "편안할 안, 어찌 안"]],
        });

        await expect(hanLookup).resolves.toEqual([{ hanja: "韓", korean: "나라 이름 한, 한나라 한" }]);
        await expect(anLookup).resolves.toEqual([{ hanja: "安", korean: "편안할 안, 어찌 안" }]);
        expect(fetchDictionary).toHaveBeenCalledTimes(1);
    });

    it("retries a later lookup after a failed load", async () => {
        const fetchDictionary = jest
            .fn()
            .mockResolvedValueOnce({ ok: false, status: 404, json: jest.fn() } as unknown as Response)
            .mockResolvedValueOnce(okJson({ 한: [["韓", "나라 이름 한, 한나라 한"]] })) as unknown as typeof fetch;
        const provider = new GeneratedHanjaDictionaryProvider(
            "chrome-extension://id/single-syllable.json",
            fetchDictionary
        );

        await expect(provider.lookup("한")).rejects.toThrow("Failed to load Hanja dictionary: 404");
        await expect(provider.lookup("한")).resolves.toEqual([{ hanja: "韓", korean: "나라 이름 한, 한나라 한" }]);
        expect(fetchDictionary).toHaveBeenCalledTimes(2);
    });
});
