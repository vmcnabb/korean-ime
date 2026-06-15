import { KeyCode } from "../../keyboard/korean-keyboard-map";
import { CompositionAdapter } from "../composition-adapters/composition-adapter";
import { HangulCompositor } from "../hangul-compositor";
import { lookUpHanja } from "./hanja-dictionary";

/**
 * Hanja conversion — the distinct phase that turns an already-composed Hangul
 * syllable into Hanja. It deliberately sits *alongside* the compositor rather than
 * inside it: jamo assembly is already done by the time this runs.
 *
 * Step 1 (#150): one-entry dictionary, single candidate, no candidate UI — the
 * sole candidate is committed immediately. Two entry points, mirroring how a real
 * IME's Hanja key behaves:
 *
 *   1. mid-composition — the block (e.g. 한) is still being composed; or
 *   2. after a committed syllable — the caret sits immediately after it.
 *
 * Returns true when a conversion happened (so the caller can swallow the key),
 * and false when there was nothing to convert: an unknown reading, no preceding
 * syllable, or an adapter that can't read/replace the previous character.
 */
export function convertHangulToHanja(compositor: HangulCompositor, adapter: CompositionAdapter): boolean {
    if (compositor.isCompositing()) {
        const hanja = firstCandidate(compositor.getCurrentChar());
        if (!hanja) {
            return false;
        }

        // Commit the Hanja in place of the in-progress block.
        adapter.endComposition(hanja);
        compositor.reset();
        return true;
    }

    if (!adapter.supportsMethods("getPreviousCharacter", "deleteContentBackwards", "inputCharacter")) {
        return false;
    }

    const hanja = firstCandidate(adapter.getPreviousCharacter());
    if (!hanja) {
        return false;
    }

    // Replace the committed syllable before the caret with its Hanja.
    adapter.deleteContentBackwards();
    adapter.inputCharacter(hanja, KeyCode.ControlRight);
    return true;
}

function firstCandidate(reading: string | undefined): string | undefined {
    return reading ? lookUpHanja(reading)[0] : undefined;
}
