import { GeneratedHanjaDictionaryProvider } from "./hanja-dictionary-provider";

jest.mock("../hanja-dictionary/dictionary.data?url", () => "dictionary.data", { virtual: true });
jest.mock("../hanja-dictionary/hanja-hanzi.data?url", () => "hanja-hanzi.data", { virtual: true });

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

    it("resolves the packaged dictionary assets and enriches a single-character match", async () => {
        const fetchDictionary = jest
            .fn()
            .mockResolvedValueOnce(okJson({ 안: [["安", "편안할 안, 어찌 안"]] }))
            .mockResolvedValueOnce(okJson({ 安: { p: "ān" } })) as unknown as typeof fetch;
        const provider = new GeneratedHanjaDictionaryProvider(undefined, undefined, fetchDictionary);

        await expect(provider.lookup("안")).resolves.toEqual({
            start: 0,
            length: 1,
            reading: "안",
            candidates: [{ hanja: "安", korean: "편안할 안, 어찌 안", pinyin: "ān" }],
        });
        expect(fetchDictionary).toHaveBeenNthCalledWith(1, "chrome-extension://id/dictionary.data");
        expect(fetchDictionary).toHaveBeenNthCalledWith(2, "chrome-extension://id/hanja-hanzi.data");
    });

    it("uses the default fetch with the worker global receiver", async () => {
        const originalFetch = globalThis.fetch;
        const fetchDictionary = jest.fn(function (this: unknown, input: RequestInfo | URL) {
            expect(this).toBe(globalThis);
            return Promise.resolve(
                okJson(
                    String(input).endsWith("hanja-hanzi.data")
                        ? { 安: { p: "ān" } }
                        : { 안: [["安", "편안할 안, 어찌 안"]] }
                )
            );
        } as typeof fetch);
        globalThis.fetch = fetchDictionary as typeof fetch;

        try {
            const provider = new GeneratedHanjaDictionaryProvider();

            await expect(provider.lookup("안").then((match) => match?.candidates)).resolves.toEqual([
                { hanja: "安", korean: "편안할 안, 어찌 안", pinyin: "ān" },
            ]);
            expect(fetchDictionary).toHaveBeenCalledWith("chrome-extension://id/dictionary.data", undefined);
            expect(fetchDictionary).toHaveBeenCalledWith("chrome-extension://id/hanja-hanzi.data", undefined);
        } finally {
            if (originalFetch) {
                globalThis.fetch = originalFetch;
            } else {
                delete (globalThis as { fetch?: typeof fetch }).fetch;
            }
        }
    });

    it("finds the leftmost-longest word and omits single-character metadata", async () => {
        const fetchDictionary = jest
            .fn()
            .mockResolvedValueOnce(
                okJson({
                    한국: [
                        ["寒國", ""],
                        ["韓國", "대한민국"],
                    ],
                    중국: [["中國", ""]],
                    한: [["韓", "나라 이름 한"]],
                })
            )
            .mockResolvedValueOnce(okJson({ 韓: { s: "韩", p: "hán" } })) as unknown as typeof fetch;
        const provider = new GeneratedHanjaDictionaryProvider(
            "chrome-extension://id/dictionary.json",
            "chrome-extension://id/hanja-hanzi.json",
            fetchDictionary
        );

        await expect(provider.lookup("한국중국")).resolves.toEqual({
            start: 0,
            length: 2,
            reading: "한국",
            candidates: [
                { hanja: "寒國", korean: "" },
                { hanja: "韓國", korean: "대한민국" },
            ],
        });
    });

    it("returns no match for an unknown run", async () => {
        const fetchDictionary = jest
            .fn()
            .mockResolvedValueOnce(okJson({ 한: [["韓", "나라 이름 한"]] }))
            .mockResolvedValueOnce(okJson({ 韓: { s: "韩", p: "hán" } })) as unknown as typeof fetch;
        const provider = new GeneratedHanjaDictionaryProvider(
            "chrome-extension://id/dictionary.json",
            "chrome-extension://id/hanja-hanzi.json",
            fetchDictionary
        );

        await expect(provider.lookup("글")).resolves.toBeUndefined();
    });

    it("fetches the generated data once and shares concurrent loads", async () => {
        let resolveDictionaryJson!: (data: unknown) => void;
        let resolveHanziJson!: (data: unknown) => void;
        const fetchDictionary = jest.fn(
            async (input: RequestInfo | URL) =>
                ({
                    ok: true,
                    status: 200,
                    json: jest.fn(
                        () =>
                            new Promise((resolve) => {
                                if (String(input).endsWith("hanja-hanzi.json")) {
                                    resolveHanziJson = resolve;
                                } else {
                                    resolveDictionaryJson = resolve;
                                }
                            })
                    ),
                }) as unknown as Response
        ) as unknown as typeof fetch;
        const provider = new GeneratedHanjaDictionaryProvider(
            "chrome-extension://id/dictionary.json",
            "chrome-extension://id/hanja-hanzi.json",
            fetchDictionary
        );

        const hanLookup = provider.lookup("한");
        const anLookup = provider.lookup("안");
        await Promise.resolve();
        resolveDictionaryJson({
            한: [["韓", "나라 이름 한"]],
            안: [["安", "편안할 안"]],
        });
        resolveHanziJson({
            韓: { s: "韩", p: "hán" },
            安: { p: "ān" },
        });

        await expect(hanLookup.then((match) => match?.candidates)).resolves.toEqual([
            { hanja: "韓", korean: "나라 이름 한", simplified: "韩", pinyin: "hán" },
        ]);
        await expect(anLookup.then((match) => match?.candidates)).resolves.toEqual([
            { hanja: "安", korean: "편안할 안", pinyin: "ān" },
        ]);
        expect(fetchDictionary).toHaveBeenCalledTimes(2);
    });

    it("retries a later lookup after a failed load", async () => {
        const fetchDictionary = jest
            .fn()
            .mockResolvedValueOnce({ ok: false, status: 404, json: jest.fn() } as unknown as Response)
            .mockResolvedValueOnce(okJson({ 韓: { s: "韩", p: "hán" } }))
            .mockResolvedValueOnce(okJson({ 한: [["韓", "나라 이름 한"]] })) as unknown as typeof fetch;
        const provider = new GeneratedHanjaDictionaryProvider(
            "chrome-extension://id/dictionary.json",
            "chrome-extension://id/hanja-hanzi.json",
            fetchDictionary
        );

        await expect(provider.lookup("한")).rejects.toThrow("Failed to load Hanja dictionary: 404");
        await expect(provider.lookup("한").then((match) => match?.candidates)).resolves.toEqual([
            { hanja: "韓", korean: "나라 이름 한", simplified: "韩", pinyin: "hán" },
        ]);
        expect(fetchDictionary).toHaveBeenCalledTimes(3);
    });
});
