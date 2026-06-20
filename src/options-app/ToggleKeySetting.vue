<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { t, type MessageKey } from "./i18n";
import {
    KeyBinding,
    currentKeyBindingPlatform,
    defaultToggleKeyBindingForPlatform,
    formatKeyBinding,
    formatModifierKeyPrefix,
    isValidToggleKeyBinding,
    keyBindingFromEvent,
} from "../keyboard/key-binding";
import { KeyCode, isModifierKey } from "../keyboard/korean-keyboard-map";
import { loadToggleKeyBinding, saveToggleKeyBinding } from "../settings/toggle-key-store";

const binding = ref<KeyBinding | null>(null);
const capturing = ref(false);
const invalid = ref(false);
// Live "Ctrl + Shift +" prefix shown while modifiers are held mid-capture.
const captureProgress = ref("");
const captureProgressAccessible = ref("");
const keyBindingPlatform = currentKeyBindingPlatform();

// A bare modifier keydown is ambiguous: pressed and released alone it's a
// lone-modifier binding (e.g. Right Alt); held while another key arrives it's
// the start of a combo (Alt+S). Hold the single-modifier candidate here; it's
// cleared once a second modifier or a normal key is pressed.
let pendingModifier: KeyBinding | null = null;

const bindingDisplay = computed(() => {
    if (capturing.value) {
        return captureProgress.value || t("options_hanYong_toggleKey_capturing");
    }
    return binding.value
        ? formatKeyBinding(binding.value, { platform: keyBindingPlatform })
        : t("options_hanYong_toggleKey_off");
});

const bindingAccessibleLabel = computed(() => {
    if (capturing.value) {
        return captureProgressAccessible.value || t("options_hanYong_toggleKey_capturing");
    }
    return binding.value
        ? formatKeyBinding(binding.value, { platform: keyBindingPlatform, labelMode: "accessible" })
        : t("options_hanYong_toggleKey_off");
});

const hintMessageKey = computed<MessageKey>(() =>
    keyBindingPlatform === "mac" ? "options_hanYong_toggleKey_hint_mac" : "options_hanYong_toggleKey_hint"
);
const invalidMessageKey = computed<MessageKey>(() =>
    keyBindingPlatform === "mac" ? "options_hanYong_toggleKey_invalid_mac" : "options_hanYong_toggleKey_invalid"
);

onMounted(async () => {
    binding.value = await loadToggleKeyBinding();
});

onUnmounted(stopCapture);

function persist(next: KeyBinding | null) {
    binding.value = next;
    void saveToggleKeyBinding(next);
}

function turnOff() {
    stopCapture();
    persist(null);
}

function resetToDefault() {
    stopCapture();
    persist(defaultToggleKeyBindingForPlatform(keyBindingPlatform));
}

function startCapture() {
    invalid.value = false;
    captureProgress.value = "";
    captureProgressAccessible.value = "";
    pendingModifier = null;
    capturing.value = true;
    window.addEventListener("keydown", onCaptureKeydown, true);
    window.addEventListener("keyup", onCaptureKeyup, true);
}

function stopCapture() {
    capturing.value = false;
    invalid.value = false;
    captureProgress.value = "";
    captureProgressAccessible.value = "";
    pendingModifier = null;
    window.removeEventListener("keydown", onCaptureKeydown, true);
    window.removeEventListener("keyup", onCaptureKeyup, true);
}

function finishCapture(captured: KeyBinding) {
    persist(captured);
    stopCapture();
}

function modifierCount(event: KeyboardEvent): number {
    return (event.ctrlKey ? 1 : 0) + (event.altKey ? 1 : 0) + (event.shiftKey ? 1 : 0) + (event.metaKey ? 1 : 0);
}

function modifierState(event: KeyboardEvent) {
    return {
        ctrl: event.ctrlKey,
        alt: event.altKey,
        shift: event.shiftKey,
        meta: event.metaKey,
    };
}

// The held modifiers as a trailing prefix, e.g. "Ctrl + Shift +" (or "" if none).
function updateCaptureProgress(event: KeyboardEvent) {
    const modifiers = modifierState(event);
    captureProgress.value = formatModifierKeyPrefix(modifiers, { platform: keyBindingPlatform });
    captureProgressAccessible.value = formatModifierKeyPrefix(modifiers, {
        platform: keyBindingPlatform,
        labelMode: "accessible",
    });
}

function onCaptureKeydown(event: KeyboardEvent) {
    event.preventDefault();
    event.stopPropagation();
    invalid.value = false; // a new keypress is a fresh attempt

    if (event.code === "Escape" && modifierCount(event) === 0) {
        stopCapture();
        return;
    }

    if (isModifierKey(event.code as KeyCode)) {
        // One modifier may become a lone binding (finalized on keyup); two or more
        // mean a combo is being built and needs a normal key to complete it.
        pendingModifier = modifierCount(event) === 1 ? keyBindingFromEvent(event) : null;
        updateCaptureProgress(event);
        return;
    }

    // A non-modifier key (with any held modifiers) completes the combo.
    pendingModifier = null;
    const captured = keyBindingFromEvent(event);
    if (!isValidToggleKeyBinding(captured, keyBindingPlatform)) {
        invalid.value = true; // invalid binding — keep capturing
        captureProgress.value = "";
        captureProgressAccessible.value = "";
        return;
    }
    finishCapture(captured);
}

function onCaptureKeyup(event: KeyboardEvent) {
    if (!capturing.value || !isModifierKey(event.code as KeyCode)) {
        return;
    }
    event.preventDefault();
    event.stopPropagation();

    // A single modifier pressed and released as the only key = a lone-modifier binding.
    if (pendingModifier?.code === event.code && modifierCount(event) === 0) {
        const captured = pendingModifier;
        pendingModifier = null;
        if (!isValidToggleKeyBinding(captured, keyBindingPlatform)) {
            invalid.value = true; // e.g. lone Shift / Win on non-Mac
            captureProgress.value = "";
            captureProgressAccessible.value = "";
            return;
        }
        finishCapture(captured);
        return;
    }

    // Released one of several held modifiers — keep showing what's still held.
    updateCaptureProgress(event);
}
</script>

<template>
    <div class="toggle-key">
        <span class="label">
            {{ t("options_hanYong_toggleKey_label") }}
            <span
                class="help"
                :title="t('options_hanYong_toggleKey_description')"
                :aria-label="t('options_hanYong_toggleKey_description')"
                >?</span
            >
        </span>
        <div class="controls">
            <span
                class="binding"
                :class="{ off: !capturing && !binding, capturing }"
                :title="bindingAccessibleLabel"
                :aria-label="bindingAccessibleLabel"
            >
                {{ bindingDisplay }}
            </span>
            <button type="button" class="ds-btn ds-btn--sm" :disabled="capturing" @click="startCapture">
                {{ t("options_hanYong_toggleKey_change") }}
            </button>
            <button type="button" class="ds-btn ds-btn--sm" :disabled="!binding && !capturing" @click="turnOff">
                {{ t("options_hanYong_toggleKey_turnOff") }}
            </button>
            <button type="button" class="ds-btn ds-btn--sm" @click="resetToDefault">
                {{ t("options_hanYong_toggleKey_reset") }}
            </button>
        </div>
        <!-- Shown only while capturing, right under the controls: the capture hint,
             or the validation error if an invalid key was pressed. The general
             description lives in the heading's "?" tooltip. -->
        <p v-if="invalid || capturing" class="feedback" :class="{ error: invalid }">
            {{ invalid ? t(invalidMessageKey) : t(hintMessageKey) }}
        </p>
    </div>
</template>

<style scoped>
/* `.label` typography is shared globally in options-page.vue */
.toggle-key .label {
    display: block;
}

/* A small "?" badge after the heading; its tooltip carries the description. */
.help {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.2em;
    height: 1.2em;
    margin-left: 0.35em;
    border: 1px solid var(--description-color);
    border-radius: 50%;
    font-size: 0.7em;
    font-weight: bold;
    color: var(--description-color);
    vertical-align: middle;
    cursor: help;
    user-select: none;
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

.binding.capturing {
    border-color: var(--toggle-on-bg);
    font-style: italic;
}

/* The contextual line under the controls swaps between hint/error/description;
   keep their top margins equal so the swap doesn't shift the layout. */
.feedback {
    margin: 0.4em 0 0;
    font-size: 0.9em;
    font-style: italic;
}

.feedback.error {
    font-style: normal;
    color: var(--error-color);
}
</style>
