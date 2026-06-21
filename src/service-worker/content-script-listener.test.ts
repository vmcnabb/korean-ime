import { HanjaDictionaryProvider } from "../composition/hanja/hanja-dictionary-provider";
import { ContentScriptRequestAction } from "../messaging/content-to-service-messages";
import { ContentScriptListener } from "./content-script-listener";
import { StateManager } from "./state-manager";

jest.mock("url:../hanja-dictionary/single-syllable.data", () => "single-syllable.data", { virtual: true });

async function settleResponse() {
    await Promise.resolve();
    await Promise.resolve();
}

describe("ContentScriptListener Hanja lookup", () => {
    let addMessageListener: jest.Mock;

    beforeEach(() => {
        addMessageListener = jest.fn();
        globalThis.chrome = {
            runtime: {
                onMessage: { addListener: addMessageListener },
            },
            tabs: {
                onActivated: { addListener: jest.fn() },
                onRemoved: { addListener: jest.fn() },
            },
        } as unknown as typeof chrome;
    });

    afterEach(() => {
        delete (globalThis as { chrome?: typeof chrome }).chrome;
    });

    it("responds directly to Hanja lookup requests", async () => {
        const provider: HanjaDictionaryProvider = {
            lookup: jest.fn(async () => [{ hanja: "韓", korean: "나라 이름 한, 한나라 한" }]),
        };
        const listener = new ContentScriptListener({} as StateManager, provider);
        listener.listen();

        const onMessage = addMessageListener.mock.calls[0][0] as Parameters<
            typeof chrome.runtime.onMessage.addListener
        >[0];
        const sendResponse = jest.fn();
        const keepChannelOpen = onMessage(
            {
                type: "contentScriptRequest",
                action: ContentScriptRequestAction.HanjaLookup,
                data: { reading: "한" },
            },
            { tab: { id: 1 } } as chrome.runtime.MessageSender,
            sendResponse
        );
        await settleResponse();

        expect(keepChannelOpen).toBe(true);
        expect(provider.lookup).toHaveBeenCalledWith("한");
        expect(sendResponse).toHaveBeenCalledWith({
            candidates: [{ hanja: "韓", korean: "나라 이름 한, 한나라 한" }],
        });
    });

    it("responds with no candidates when lookup fails", async () => {
        const provider: HanjaDictionaryProvider = {
            lookup: jest.fn(async () => {
                throw new Error("boom");
            }),
        };
        const listener = new ContentScriptListener({} as StateManager, provider);
        listener.listen();

        const onMessage = addMessageListener.mock.calls[0][0] as Parameters<
            typeof chrome.runtime.onMessage.addListener
        >[0];
        const sendResponse = jest.fn();
        const keepChannelOpen = onMessage(
            {
                type: "contentScriptRequest",
                action: ContentScriptRequestAction.HanjaLookup,
                data: { reading: "한" },
            },
            { tab: { id: 1 } } as chrome.runtime.MessageSender,
            sendResponse
        );
        await settleResponse();

        expect(keepChannelOpen).toBe(true);
        expect(sendResponse).toHaveBeenCalledWith({ candidates: [] });
    });
});
