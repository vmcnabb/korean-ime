import { KeyCode } from "../../keyboard/korean-keyboard-map";
import { CompositionAdapter } from "../composition-adapters/composition-adapter";
import { BeforeCaretTextRange } from "../composition-adapters/composition-adapter-interface";
import { HanjaCandidate } from "./hanja-candidate";

export type HanjaConversionContext = {
    run: string;
};

export type HanjaConversionTarget = {
    run: string;
    matchStart: number;
    reading: string;
};

export type CommitHanjaCandidateOptions = {
    useSimplified?: boolean;
};

/**
 * Collect the contiguous Hangul/Jamo run immediately before the caret. The key
 * listener commits any in-progress Hangul block before this runs, so conversion
 * only reads committed text.
 */
export function getHanjaConversionContext(adapter: CompositionAdapter): HanjaConversionContext | undefined {
    if (!adapter.supportsMethods("getTextBeforeCaret", "replaceTextBeforeCaret")) {
        return undefined;
    }

    const beforeCaret = adapter.getTextBeforeCaret();
    if (!beforeCaret) {
        return undefined;
    }

    const characters = [...beforeCaret];
    let start = characters.length;
    while (start > 0 && isHanjaReadingCharacter(characters[start - 1])) {
        start -= 1;
    }

    const run = characters.slice(start).join("");
    return run ? { run } : undefined;
}

export function commitHanjaCandidate(
    candidate: HanjaCandidate,
    target: HanjaConversionTarget,
    adapter: CompositionAdapter,
    keyCode: KeyCode,
    options: CommitHanjaCandidateOptions = {}
): boolean {
    const hanja = options.useSimplified && candidate.simplified ? candidate.simplified : candidate.hanja;
    // Re-compose the entire run with only the matched portion converted, matching
    // the native IME (한국말 → 韓國말): unmatched leading and trailing Hangul ride
    // along rather than being replaced piecemeal.
    const characters = [...target.run];
    const readingLength = [...target.reading].length;
    const commitText =
        characters.slice(0, target.matchStart).join("") +
        hanja +
        characters.slice(target.matchStart + readingLength).join("");
    return adapter.replaceTextBeforeCaret(completeRunTextRange(target), commitText, keyCode);
}

export function completeRunTextRange(target: HanjaConversionTarget): BeforeCaretTextRange {
    return { text: target.run, offset: 0 };
}

export function matchedTextRange(target: HanjaConversionTarget): BeforeCaretTextRange {
    const characters = [...target.run];
    const matchedEnd = target.matchStart + [...target.reading].length;
    const trailingText = characters.slice(matchedEnd).join("");
    return { text: target.reading, offset: trailingText.length };
}

export function isHanjaReadingCharacter(character: string): boolean {
    const codePoint = character.codePointAt(0);
    return (
        codePoint !== undefined &&
        ((codePoint >= 0x1100 && codePoint <= 0x11ff) ||
            (codePoint >= 0x3130 && codePoint <= 0x318f) ||
            (codePoint >= 0xa960 && codePoint <= 0xa97f) ||
            (codePoint >= 0xac00 && codePoint <= 0xd7a3) ||
            (codePoint >= 0xd7b0 && codePoint <= 0xd7ff))
    );
}
