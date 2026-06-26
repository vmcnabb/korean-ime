import { HanjaCandidate } from "../composition/hanja/hanja-candidate";
import { HanjaDictionaryProvider } from "../composition/hanja/hanja-dictionary-provider";
import { api } from "../platform/browser-api";
import generatedDictionaryUrl from "../hanja-dictionary/single-syllable.data?url";
import generatedHanziMetadataUrl from "../hanja-dictionary/hanja-hanzi.data?url";

type GeneratedHanjaCandidate = readonly [hanja: string, korean: string];
type GeneratedHanjaDictionary = Record<string, readonly GeneratedHanjaCandidate[]>;
type GeneratedHanziMetadata = Record<string, { s?: string; p?: string }>;
const defaultFetchDictionary: typeof fetch = (input, init) => globalThis.fetch(input, init);

export class GeneratedHanjaDictionaryProvider implements HanjaDictionaryProvider {
    private dictionaryPromise?: Promise<GeneratedHanjaDictionary>;
    private hanziMetadataPromise?: Promise<GeneratedHanziMetadata>;

    constructor(
        private readonly dictionaryUrl = resolveExtensionResourceUrl(generatedDictionaryUrl),
        private readonly hanziMetadataUrl = resolveExtensionResourceUrl(generatedHanziMetadataUrl),
        private readonly fetchDictionary: typeof fetch = defaultFetchDictionary
    ) {}

    async lookup(reading: string): Promise<readonly HanjaCandidate[]> {
        const [dictionary, hanziMetadata] = await Promise.all([this.loadDictionary(), this.loadHanziMetadata()]);
        return (dictionary[reading] ?? []).map(([hanja, korean]) => {
            const metadata = hanziMetadata[hanja];
            return {
                hanja,
                korean,
                ...(metadata?.s ? { simplified: metadata.s } : {}),
                ...(metadata?.p ? { pinyin: metadata.p } : {}),
            };
        });
    }

    private loadDictionary(): Promise<GeneratedHanjaDictionary> {
        this.dictionaryPromise ??= this.fetchJson<GeneratedHanjaDictionary>(
            this.dictionaryUrl,
            "Hanja dictionary"
        ).catch((error) => {
            this.dictionaryPromise = undefined;
            throw error;
        });

        return this.dictionaryPromise;
    }

    private loadHanziMetadata(): Promise<GeneratedHanziMetadata> {
        this.hanziMetadataPromise ??= this.fetchJson<GeneratedHanziMetadata>(
            this.hanziMetadataUrl,
            "Hanja/Hanzi metadata"
        ).catch((error) => {
            this.hanziMetadataPromise = undefined;
            throw error;
        });

        return this.hanziMetadataPromise;
    }

    private async fetchJson<T>(url: string, label: string): Promise<T> {
        const response = await this.fetchDictionary(url);
        if (!response.ok) {
            throw new Error(`Failed to load ${label}: ${response.status}`);
        }
        return response.json() as Promise<T>;
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
