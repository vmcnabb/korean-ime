import { HanjaCandidate } from "../composition/hanja/hanja-candidate";
import { HanjaDictionaryProvider } from "../composition/hanja/hanja-dictionary-provider";
import { api } from "../platform/browser-api";
import generatedDictionaryUrl from "url:../hanja-dictionary/single-syllable.data";

type GeneratedHanjaCandidate = readonly [hanja: string, korean: string];
type GeneratedHanjaDictionary = Record<string, readonly GeneratedHanjaCandidate[]>;
const defaultFetchDictionary: typeof fetch = (input, init) => globalThis.fetch(input, init);

export class GeneratedHanjaDictionaryProvider implements HanjaDictionaryProvider {
    private dictionaryPromise?: Promise<GeneratedHanjaDictionary>;

    constructor(
        private readonly dictionaryUrl = resolveExtensionResourceUrl(generatedDictionaryUrl),
        private readonly fetchDictionary: typeof fetch = defaultFetchDictionary
    ) {}

    async lookup(reading: string): Promise<readonly HanjaCandidate[]> {
        const dictionary = await this.loadDictionary();
        return (dictionary[reading] ?? []).map(([hanja, korean]) => ({ hanja, korean }));
    }

    private loadDictionary(): Promise<GeneratedHanjaDictionary> {
        this.dictionaryPromise ??= this.fetchDictionary(this.dictionaryUrl)
            .then((response) => {
                if (!response.ok) {
                    throw new Error(`Failed to load Hanja dictionary: ${response.status}`);
                }
                return response.json() as Promise<GeneratedHanjaDictionary>;
            })
            .catch((error) => {
                this.dictionaryPromise = undefined;
                throw error;
            });

        return this.dictionaryPromise;
    }
}

function resolveExtensionResourceUrl(urlOrPath: string): string {
    try {
        new URL(urlOrPath);
        return urlOrPath;
    } catch {
        return api.runtime.getURL(urlOrPath.replace(/^\.\//, ""));
    }
}
