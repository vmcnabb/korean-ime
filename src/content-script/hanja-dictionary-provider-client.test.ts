import { ContentScriptRequestAction } from "../messaging/content-to-service-messages";
import { ServiceWorkerHanjaDictionaryProviderClient } from "./hanja-dictionary-provider-client";

describe("ServiceWorkerHanjaDictionaryProviderClient", () => {
    let sendMessage: jest.Mock;

    beforeEach(() => {
        sendMessage = jest.fn();
        globalThis.chrome = {
            runtime: { sendMessage },
        } as unknown as typeof chrome;
    });

    afterEach(() => {
        delete (globalThis as { browser?: typeof chrome }).browser;
        delete (globalThis as { chrome?: typeof chrome }).chrome;
    });

    it("requests Hanja candidates from the Chrome service worker with a callback", async () => {
        sendMessage.mockImplementation((_message, callback) => {
            callback({
                candidates: [{ hanja: "韓", korean: "나라 이름 한, 한나라 한" }],
            });
        });
        const provider = new ServiceWorkerHanjaDictionaryProviderClient();

        await expect(provider.lookup("한")).resolves.toEqual([{ hanja: "韓", korean: "나라 이름 한, 한나라 한" }]);
        expect(sendMessage).toHaveBeenCalledWith(
            {
                type: "contentScriptRequest",
                action: ContentScriptRequestAction.HanjaLookup,
                data: { reading: "한" },
            },
            expect.any(Function)
        );
    });

    it("requests Hanja candidates from the Firefox service worker with a promise", async () => {
        sendMessage.mockResolvedValue({
            candidates: [{ hanja: "韓", korean: "나라 이름 한, 한나라 한" }],
        });
        (globalThis as { browser?: typeof chrome }).browser = {
            runtime: { sendMessage },
        } as unknown as typeof chrome;
        const provider = new ServiceWorkerHanjaDictionaryProviderClient();

        await expect(provider.lookup("한")).resolves.toEqual([{ hanja: "韓", korean: "나라 이름 한, 한나라 한" }]);
        expect(sendMessage).toHaveBeenCalledWith({
            type: "contentScriptRequest",
            action: ContentScriptRequestAction.HanjaLookup,
            data: { reading: "한" },
        });
    });

    it("treats an empty service-worker response as no candidates", async () => {
        sendMessage.mockImplementation((_message, callback) => {
            callback(undefined);
        });
        const provider = new ServiceWorkerHanjaDictionaryProviderClient();

        await expect(provider.lookup("한")).resolves.toEqual([]);
    });
});
