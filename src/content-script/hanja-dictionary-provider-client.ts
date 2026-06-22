import { HanjaCandidate } from "../composition/hanja/hanja-candidate";
import { HanjaDictionaryProvider } from "../composition/hanja/hanja-dictionary-provider";
import {
    ContentScriptRequestAction,
    ContentScriptRequestMessage,
    HanjaLookupResponse,
} from "../messaging/content-to-service-messages";
import { api } from "../platform/browser-api";

export class ServiceWorkerHanjaDictionaryProviderClient implements HanjaDictionaryProvider {
    async lookup(reading: string): Promise<readonly HanjaCandidate[]> {
        const message = {
            type: "contentScriptRequest",
            action: ContentScriptRequestAction.HanjaLookup,
            data: { reading },
        } satisfies ContentScriptRequestMessage;

        if ((globalThis as { browser?: typeof chrome }).browser) {
            const response = (await api.runtime.sendMessage(message)) as HanjaLookupResponse | undefined;
            return response?.candidates ?? [];
        }

        return new Promise((resolve) => {
            api.runtime.sendMessage(message, (response: HanjaLookupResponse | undefined) => {
                if (api.runtime.lastError) {
                    resolve([]);
                    return;
                }

                resolve(response?.candidates ?? []);
            });
        });
    }
}
