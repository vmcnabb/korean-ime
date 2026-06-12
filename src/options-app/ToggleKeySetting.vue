<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";
import { t } from "./i18n";
import {
    KeyBinding,
    defaultToggleKeyBinding,
    formatKeyBinding,
    isValidToggleKeyBinding,
    keyBindingFromEvent,
} from "../keyboard/key-binding";
import { KeyCode, isModifierKey } from "../keyboard/korean-keyboard-map";
import { loadToggleKeyBinding, saveToggleKeyBinding } from "../settings/toggle-key-store";

const binding = ref<KeyBinding | null>(null);
const capturing = ref(false);
const invalid = ref(false);

// A bare modifier keydown is ambiguous: it could be a lone-modifier binding
// (e.g. Right Alt) finalized on its keyup, or the start of a combo (Alt+S)
// finalized when the non-modifier key arrives. Hold it here until we know which.
let pendingModifier: KeyBinding | null = null;

onMounted(async () => {
    binding.value = await loadToggleKeyBinding();
});

onUnmounted(stopCapture);

function persist(next: KeyBinding | null) {
    binding.value = next;
    void saveToggleKeyBinding(next);
}

function resetToDefault() {
    invalid.value = false;
    persist(structuredClone(defaultToggleKeyBinding));
}

function startCapture() {
    invalid.value = false;
    pendingModifier = null;
    capturing.value = true;
    window.addEventListener("keydown", onCaptureKeydown, true);
    window.addEventListener("keyup", onCaptureKeyup, true);
}

function stopCapture() {
    capturing.value = false;
    pendingModifier = null;
    window.removeEventListener("keydown", onCaptureKeydown, true);
    window.removeEventListener("keyup", onCaptureKeyup, true);
}

function finishCapture(captured: KeyBinding) {
    invalid.value = false;
    persist(captured);
    stopCapture();
}

function onCaptureKeydown(event: KeyboardEvent) {
    event.preventDefault();
    event.stopPropagation();

    if (event.code === "Escape" && !event.ctrlKey && !event.altKey && !event.shiftKey && !event.metaKey) {
        stopCapture();
        return;
    }

    if (isModifierKey(event.code as KeyCode)) {
        // Could be a lone modifier (finalized on keyup) or the start of a combo.
        pendingModifier = keyBindingFromEvent(event);
        return;
    }

    // A non-modifier key (possibly with modifiers held) ends the combo now.
    pendingModifier = null;
    const captured = keyBindingFromEvent(event);
    if (!isValidToggleKeyBinding(captured)) {
        invalid.value = true; // needs Ctrl or Alt — keep capturing
        return;
    }
    finishCapture(captured);
}

function onCaptureKeyup(event: KeyboardEvent) {
    if (!capturing.value) {
        return;
    }
    event.preventDefault();
    event.stopPropagation();

    // A modifier released with nothing pressed after it = a lone-modifier binding.
    if (isModifierKey(event.code as KeyCode) && pendingModifier?.code === event.code) {
        const captured = pendingModifier;
        pendingModifier = null;
        if (!isValidToggleKeyBinding(captured)) {
            invalid.value = true; // e.g. lone Shift / Win — needs Ctrl or Alt
            return;
        }
        finishCapture(captured);
    }
}
</script>

<template>
    <div class="toggle-key">
        <span class="label">{{ t("options_hanYong_toggleKey_label") }}</span>
        <div class="controls">
            <span class="binding" :class="{ off: !binding }">
                {{ binding ? formatKeyBinding(binding) : t("options_hanYong_toggleKey_off") }}
            </span>
            <button type="button" :disabled="capturing" @click="startCapture">
                {{ capturing ? t("options_hanYong_toggleKey_capturing") : t("options_hanYong_toggleKey_change") }}
            </button>
            <button type="button" :disabled="!binding" @click="persist(null)">
                {{ t("options_hanYong_toggleKey_turnOff") }}
            </button>
            <button type="button" @click="resetToDefault">
                {{ t("options_hanYong_toggleKey_reset") }}
            </button>
        </div>
        <p class="description">{{ t("options_hanYong_toggleKey_description") }}</p>
        <p v-if="capturing" class="description capturing-hint">{{ t("options_hanYong_toggleKey_hint") }}</p>
        <p v-if="invalid" class="error">{{ t("options_hanYong_toggleKey_invalid") }}</p>
    </div>
</template>

<style scoped>
.toggle-key {
    margin: 0.75em 0;
}

/* `.label` / `.description` typography is shared globally in options-page.vue */
.toggle-key .label {
    display: block;
    margin-bottom: 0.25em;
}

.controls {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5em;
}

.binding {
    min-width: 5em;
    padding: 0.2em 0.6em;
    border: 1px solid var(--section-border);
    border-radius: 4px;
    font-family: monospace;
    text-align: center;
}

.binding.off {
    color: var(--description-color);
    font-style: italic;
}

.controls button {
    font-size: 0.95em;
    padding: 0.25em 0.6em;
}

.capturing-hint {
    font-style: italic;
}

.error {
    margin: 0.25em 0 0;
    font-size: 0.9em;
    color: var(--error-color, #c0392b);
}
</style>
