import { KeyCode } from "../../keyboard/korean-keyboard-map";
import { CompositionAdapter } from "../composition-adapters/composition-adapter";
import { HangulCompositor } from "../hangul-compositor";
import { HanjaCandidate } from "./hanja-candidate";

export type HanjaConversionTarget =
    | {
          kind: "composition";
          reading: string;
      }
    | {
          kind: "previous-character";
          reading: string;
      };

/**
 * Hanja conversion — the distinct phase that turns an already-composed Hangul
 * syllable into Hanja. It deliberately sits *alongside* the compositor rather than
 * inside it: jamo assembly is already done by the time this runs.
 *
 * Two entry points, mirroring how a real IME's Hanja key behaves:
 *
 *   1. mid-composition — the block (e.g. 한) is still being composed; or
 *   2. after a committed syllable — the caret sits immediately after it.
 */
export function getHanjaConversionTarget(
    compositor: HangulCompositor,
    adapter: CompositionAdapter
): HanjaConversionTarget | undefined {
    if (compositor.isCompositing()) {
        const reading = compositor.getCurrentChar();
        if (!isSingleHangulSyllable(reading)) {
            return undefined;
        }

        return { kind: "composition", reading };
    }

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
    target: HanjaConversionTarget,
    candidate: HanjaCandidate,
    compositor: HangulCompositor,
    adapter: CompositionAdapter,
    keyCode: KeyCode
): void {
    if (target.kind === "composition") {
        adapter.endComposition(candidate.hanja);
        compositor.reset();
        return;
    }

    adapter.deleteContentBackwards();
    adapter.inputCharacter(candidate.hanja, keyCode);
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
