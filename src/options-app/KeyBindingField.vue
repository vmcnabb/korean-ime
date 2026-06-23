<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, toRefs } from "vue";
import { t, type MessageKey } from "../i18n";
import {
    KeyBinding,
    currentKeyBindingPlatform,
    formatKeyBinding,
    formatModifierKeyPrefix,
    isValidImeActionKeyBinding,
    keyBindingFromEvent,
} from "../keyboard/key-binding";
import { KeyCode, isModifierKey } from "../keyboard/korean-keyboard-map";
import { api } from "../platform/browser-api";
import { KeyBindingFieldConfig, resolveKeyBindingCollision } from "./key-binding-settings";

// One configurable IME key, supplied by the parent section as data (see
// key-binding-settings.ts). The component knows nothing feature-specific.
const props = defineProps<{
    config: KeyBindingFieldConfig;
}>();

const { config } = toRefs(props);

const binding = ref<KeyBinding | null>(null);
const capturing = ref(false);
const invalid = ref(false);
const statusMessage = ref("");
const statusWarning = ref(false);
// Live "Ctrl + Shift +" prefix shown while modifiers are held mid-capture.
const captureProgress = ref("");
const captureProgressAccessible = ref("");
const keyBindingPlatform = currentKeyBindingPlatform();
let storageChangeListener: ((changes: Record<string, chrome.storage.StorageChange>, areaName: string) => void) | null =
    null;

// A bare modifier keydown is ambiguous: pressed and released alone it's a
// lone-modifier binding (e.g. Right Alt); held while another key arrives it's
// the start of a combo (Alt+S). Hold the single-modifier candidate here; it's
// cleared once a second modifier or a normal key is pressed.
let pendingModifier: KeyBinding | null = null;

const bindingDisplay = computed(() => {
    if (capturing.value) {
        return captureProgress.value || t("options_keyBinding_capturing");
    }
    return binding.value
        ? formatKeyBinding(binding.value, { platform: keyBindingPlatform })
        : t("options_keyBinding_off");
});

const bindingAccessibleLabel = computed(() => {
    if (capturing.value) {
        return captureProgressAccessible.value || t("options_keyBinding_capturing");
    }
    return binding.value
        ? formatKeyBinding(binding.value, { platform: keyBindingPlatform, labelMode: "accessible" })
        : t("options_keyBinding_off");
});

// The binding box is now a button; give it a self-describing accessible name
// (field label + current value) so it reads as the key-binding control rather
// than a bare value when a screen reader lands on it.
const bindingButtonLabel = computed(() => `${t(config.value.labelKey)}: ${bindingAccessibleLabel.value}`);

const hintMessageKey = computed<MessageKey>(() =>
    keyBindingPlatform === "mac" ? "options_keyBinding_hint_mac" : "options_keyBinding_hint"
);
const invalidMessageKey = computed<MessageKey>(() =>
    keyBindingPlatform === "mac" ? "options_keyBinding_invalid_mac" : "options_keyBinding_invalid"
);

onMounted(async () => {
    await reloadBinding();
    storageChangeListener = (changes, areaName) => {
        if (areaName === "local" && config.value.storageKey in changes) {
            reloadBinding().catch((error) => console.error("reloadBinding failed:", error));
        }
    };
    api.storage.onChanged.addListener(storageChangeListener);
});

onUnmounted(() => {
    stopCapture();
    if (storageChangeListener) {
        api.storage.onChanged.removeListener(storageChangeListener);
        storageChangeListener = null;
    }
});

async function reloadBinding() {
    binding.value = await config.value.loadBinding();
}

async function persist(next: KeyBinding | null) {
    statusMessage.value = "";
    statusWarning.value = false;
    const collisionStatus = next ? await resolveKeyBindingCollision(config.value, next) : "";
    binding.value = next;
    await config.value.saveBinding(next);
    statusMessage.value = collisionStatus;
    statusWarning.value = !!collisionStatus;
}

function turnOff() {
    stopCapture();
    void persist(null);
}

function resetToDefault() {
    stopCapture();
    void persist(config.value.defaultBindingForPlatform(keyBindingPlatform));
}

function startCapture() {
    statusMessage.value = "";
    statusWarning.value = false;
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
    void persist(captured);
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
    if (!isValidImeActionKeyBinding(captured, keyBindingPlatform)) {
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
        if (!isValidImeActionKeyBinding(captured, keyBindingPlatform)) {
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
    <div class="key-binding-field">
        <span class="label">
            {{ t(config.labelKey) }}
            <span
                class="help"
                :title="t(config.descriptionKey)"
                :aria-label="t(config.descriptionKey)"
                >?</span
            >
        </span>
        <div class="controls">
            <!-- The binding box is the capture control: activating it (click or
                 Enter/Space) starts listening for a key. It reuses .ds-field, so
                 keyboard focus inherits the shared focus ring; .ds-focus-ring
                 forces that same ring while capturing. Blur cancels an in-progress
                 capture, so clicking (or otherwise moving focus) away bails out —
                 the same as Esc. -->
            <button
                type="button"
                class="ds-field ds-field--compact binding"
                :class="{ off: !capturing && !binding, capturing, 'ds-focus-ring': capturing }"
                :title="bindingAccessibleLabel"
                :aria-label="bindingButtonLabel"
                @click="startCapture"
                @blur="stopCapture"
            >
                {{ bindingDisplay }}
            </button>
            <button type="button" class="ds-btn ds-btn--sm" :disabled="!binding && !capturing" @click="turnOff">
                {{ t("options_keyBinding_turnOff") }}
            </button>
            <button type="button" class="ds-btn ds-btn--sm" @click="resetToDefault">
                {{ t("options_keyBinding_reset") }}
            </button>
        </div>
        <!-- Shown only while capturing, right under the controls: the capture hint,
             or the validation error if an invalid key was pressed. The general
             description lives in the heading's "?" tooltip. -->
        <p
            v-if="invalid || capturing || statusMessage"
            class="feedback"
            :class="{ error: invalid, warning: statusWarning && !invalid }"
            role="status"
        >
            {{ invalid ? t(invalidMessageKey) : statusMessage || t(hintMessageKey) }}
        </p>
    </div>
</template>

<style scoped>
/* `.label` typography is shared globally in options-page.vue */
.key-binding-field .label {
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
    /* .ds-field provides the border, background, padding and the :focus-visible
       ring; only the bits specific to a clickable monospace value box live here. */
    min-width: 5em;
    border-radius: var(--radius-sm);
    font-family: monospace;
    text-align: center;
    cursor: pointer;
    appearance: none;
}

.binding:hover {
    background-color: var(--button-hover-bg);
}

.binding.off {
    color: var(--description-color);
    font-style: italic;
}

.binding.capturing {
    /* "Listening for a key" is an active state: the focus ring comes from the
       shared .ds-focus-ring class (applied in the template), so it tracks any
       future change to the ring. This rule only adds the italic. */
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

.feedback.warning {
    font-style: normal;
    color: var(--warning-text-color);
}
</style>
