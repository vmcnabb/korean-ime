import { KeyCode } from "../../keyboard/korean-keyboard-map";
import { CompositionAdapter } from "../composition-adapters/composition-adapter";
import { HanjaCandidate } from "./hanja-candidate";

export type HanjaConversionTarget = {
    kind: "previous-character";
    reading: string;
};

export type CommitHanjaCandidateOptions = {
    useSimplified?: boolean;
};

/**
 * Hanja conversion — the distinct phase that turns an already-composed Hangul
 * syllable into Hanja. The key listener commits any in-progress Hangul block before
 * this runs, so conversion only ever reads the committed character before the caret.
 */
export function getHanjaConversionTarget(adapter: CompositionAdapter): HanjaConversionTarget | undefined {
    if (!adapter.supportsMethods("getPreviousCharacter", "deleteContentBackwards", "inputCharacter")) {
        return undefined;
    }

    const reading = adapter.getPreviousCharacter();
    if (!reading) {
        return undefined;
    }

    return isSingleHangulSyllable(reading) ? { kind: "previous-character", reading } : undefined;
}

export function commitHanjaCandidate(
    candidate: HanjaCandidate,
    adapter: CompositionAdapter,
    keyCode: KeyCode,
    options: CommitHanjaCandidateOptions = {}
): void {
    adapter.deleteContentBackwards();
    adapter.inputCharacter(
        options.useSimplified && candidate.simplified ? candidate.simplified : candidate.hanja,
        keyCode
    );
}

function isSingleHangulSyllable(text: string): boolean {
    if ([...text].length !== 1) {
        return false;
    }

    const codePoint = text.codePointAt(0);
    if (codePoint === undefined) {
        return false;
    }

    return codePoint >= 0xac00 && codePoint <= 0xd7a3;
}
