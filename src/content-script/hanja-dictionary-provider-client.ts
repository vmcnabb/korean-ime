import { HanjaDictionaryMatch, HanjaDictionaryProvider } from "../composition/hanja/hanja-dictionary-provider";
import {
    ContentScriptRequestAction,
    ContentScriptRequestMessage,
    HanjaLookupResponse,
} from "../messaging/content-to-service-messages";
import { api } from "../platform/browser-api";

export class ServiceWorkerHanjaDictionaryProviderClient implements HanjaDictionaryProvider {
    async lookup(run: string): Promise<HanjaDictionaryMatch | undefined> {
        const message = {
            type: "contentScriptRequest",
            action: ContentScriptRequestAction.HanjaLookup,
            data: { run },
        } satisfies ContentScriptRequestMessage;

        if ((globalThis as { browser?: typeof chrome }).browser) {
            const response = (await api.runtime.sendMessage(message)) as HanjaLookupResponse | undefined;
            return response?.match;
        }

        return new Promise((resolve) => {
            api.runtime.sendMessage(message, (response: HanjaLookupResponse | undefined) => {
                if (api.runtime.lastError) {
                    resolve(undefined);
                    return;
                }

                resolve(response?.match);
            });
        });
    }
}
