import { onMounted, onUnmounted, ref } from "vue";
import { ImeKeySettingKind, KeyBindingUnboundEventDetail, keyBindingUnboundEvent } from "./key-binding-events";

/**
 * How long the "this key was just unbound" highlight stays on, in milliseconds.
 * Must match the `key-binding-flash` CSS animation duration in options-page.vue.
 */
const FLASH_DURATION_MS = 1500;

/**
 * Briefly highlight a key-binding setting when its binding is unbound by a
 * collision in the *other* section. Both the Han/Yong and Hanja sections use
 * this: each listens for the shared unbound event and flashes only when the
 * event targets its own `kind`.
 *
 * Returns a `keyBindingFlash` ref to bind to the `.key-binding-flash` class.
 */
export function useKeyBindingFlash(kind: ImeKeySettingKind) {
    const keyBindingFlash = ref(false);
    let flashTimeout: number | undefined;

    function onKeyBindingUnbound(event: Event) {
        const detail = (event as CustomEvent<KeyBindingUnboundEventDetail>).detail;
        if (detail.kind !== kind) {
            return;
        }

        // Restart the animation even if a previous flash is still showing: clear
        // the class, then re-add it on the next frame so the keyframes replay.
        keyBindingFlash.value = false;
        window.clearTimeout(flashTimeout);
        window.requestAnimationFrame(() => {
            keyBindingFlash.value = true;
            flashTimeout = window.setTimeout(() => {
                keyBindingFlash.value = false;
            }, FLASH_DURATION_MS);
        });
    }

    onMounted(() => window.addEventListener(keyBindingUnboundEvent, onKeyBindingUnbound));
    onUnmounted(() => {
        window.removeEventListener(keyBindingUnboundEvent, onKeyBindingUnbound);
        window.clearTimeout(flashTimeout);
    });

    return { keyBindingFlash };
}
