import { KeyCode } from "../../keyboard/korean-keyboard-map";
import { CompositionAdapter } from "../composition-adapters/composition-adapter";
import { HangulCompositor } from "../hangul-compositor";
import { lookUpHanja } from "./hanja-dictionary";

export type HanjaConversionTarget =
    | {
          kind: "composition";
          reading: string;
          candidates: readonly string[];
      }
    | {
          kind: "previous-character";
          reading: string;
          candidates: readonly string[];
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
        const candidates = lookUpHanja(reading);
        if (candidates.length === 0) {
            return undefined;
        }

        return { kind: "composition", reading, candidates };
    }

    if (!adapter.supportsMethods("getPreviousCharacter", "deleteContentBackwards", "inputCharacter")) {
        return undefined;
    }

    const reading = adapter.getPreviousCharacter();
    if (!reading) {
        return undefined;
    }

    const candidates = lookUpHanja(reading);
    return candidates.length === 0 ? undefined : { kind: "previous-character", reading, candidates };
}

export function commitHanjaCandidate(
    target: HanjaConversionTarget,
    candidate: string,
    compositor: HangulCompositor,
    adapter: CompositionAdapter,
    keyCode: KeyCode
): void {
    if (target.kind === "composition") {
        adapter.endComposition(candidate);
        compositor.reset();
        return;
    }

    adapter.deleteContentBackwards();
    adapter.inputCharacter(candidate, keyCode);
}
