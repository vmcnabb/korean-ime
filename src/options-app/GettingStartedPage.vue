<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from "vue";
import { currentKeyBindingPlatform } from "../keyboard/key-binding";
import { api } from "../platform/browser-api";
import { GettingStartedChoice, gettingStartedChoices } from "./getting-started-model";
import { t, type MessageKey } from "../i18n";
import { initSettings, settings } from "./use-settings";
import pinDarkVideo from "url:../videos/pin-dark.mp4";
import pinLightVideo from "url:../videos/pin-light.mp4";

const loading = ref(true);
const errorMessage = ref("");
const pinningVideo = ref<HTMLVideoElement>();
const showPinningVideo = ref(false);
const optionsPageHref = getOptionsPageHref();
const pinningVideoSrc = getPreferredPinningVideoSrc();
const pinningVideoId = "pinning-video";
const keyBindingPlatform = currentKeyBindingPlatform();

const selectedChoice = computed<GettingStartedChoice>(() =>
    settings.hanYong.enabled ? gettingStartedChoices.typeHangul : gettingStartedChoices.otherTools
);
const isFirefoxFamily = browserHasFirefoxExtensionMenu();
const pinningGuidance = computed(() =>
    isFirefoxFamily ? t("gettingStarted_showIcon_firefox") : t("gettingStarted_showIcon_chrome")
);
const gettingStartedNoticeKey = computed<MessageKey>(() =>
    keyBindingPlatform === "mac" ? "gettingStarted_notice_mac" : "gettingStarted_notice"
);

onMounted(async () => {
    try {
        await initSettings();
    } catch (error) {
        errorMessage.value = t("gettingStarted_errorLoad");
        console.error(error);
    } finally {
        loading.value = false;
    }
});

function choose(choice: GettingStartedChoice): void {
    errorMessage.value = "";
    settings.hanYong.enabled = choice === gettingStartedChoices.typeHangul;
}

async function revealPinningVideo(): Promise<void> {
    showPinningVideo.value = true;
    await nextTick();

    const video = pinningVideo.value;
    if (!video) {
        return;
    }

    try {
        video.currentTime = 0;
        await video.play();
    } catch {
        // The controls remain visible if a browser blocks autoplay for any reason.
    }
}

function browserHasFirefoxExtensionMenu(): boolean {
    try {
        return typeof (api.runtime as { getBrowserInfo?: unknown }).getBrowserInfo === "function";
    } catch {
        return false;
    }
}

function getOptionsPageHref(): string {
    const url = new URL(globalThis.location.href);
    url.searchParams.delete("view");
    return url.href;
}

function getPreferredPinningVideoSrc(): string {
    try {
        return globalThis.matchMedia("(prefers-color-scheme: dark)").matches ? pinDarkVideo : pinLightVideo;
    } catch {
        return pinLightVideo;
    }
}
</script>

<template>
    <main class="getting-started-page">
        <h1>{{ t("gettingStarted_title") }}</h1>
        <p class="description intro">{{ t("gettingStarted_intro") }}</p>

        <section>
            <fieldset :disabled="loading">
                <legend>{{ t("gettingStarted_question") }}</legend>

                <label class="choice-card" :class="{ selected: selectedChoice === gettingStartedChoices.typeHangul }">
                    <input
                        type="radio"
                        class="visually-hidden"
                        name="getting-started-choice"
                        :checked="selectedChoice === gettingStartedChoices.typeHangul"
                        @change="choose(gettingStartedChoices.typeHangul)"
                    />
                    <span>
                        <strong>{{ t("gettingStarted_choiceTypeHangul_label") }}</strong>
                        <span class="description">{{ t("gettingStarted_choiceTypeHangul_description") }}</span>
                    </span>
                </label>

                <label class="choice-card" :class="{ selected: selectedChoice === gettingStartedChoices.otherTools }">
                    <input
                        type="radio"
                        class="visually-hidden"
                        name="getting-started-choice"
                        :checked="selectedChoice === gettingStartedChoices.otherTools"
                        @change="choose(gettingStartedChoices.otherTools)"
                    />
                    <span>
                        <strong>{{ t("gettingStarted_choiceOtherTools_label") }}</strong>
                        <span class="description">{{ t("gettingStarted_choiceOtherTools_description") }}</span>
                    </span>
                </label>
            </fieldset>

            <p v-if="selectedChoice === gettingStartedChoices.otherTools" class="notice" role="status">
                {{ t("gettingStarted_noticeOtherTools") }}
            </p>
            <p v-else-if="selectedChoice === gettingStartedChoices.typeHangul" class="notice" role="status">
                {{ t(gettingStartedNoticeKey) }}
            </p>
            <p v-if="errorMessage" class="error" role="alert">{{ errorMessage }}</p>
        </section>

        <section>
            <h2>{{ t("gettingStarted_showIcon_heading") }}</h2>
            <p class="description">{{ pinningGuidance }}</p>
            <p v-if="!showPinningVideo" class="pinning-video-action">
                <button
                    class="ds-btn ds-btn--primary"
                    type="button"
                    :aria-controls="pinningVideoId"
                    @click="revealPinningVideo"
                >
                    {{ t("gettingStarted_showIcon_showVideo") }}
                </button>
            </p>
            <Transition name="pinning-video-reveal">
                <div class="video-container"
                    v-if="showPinningVideo">
                    <video
                        :id="pinningVideoId"
                        ref="pinningVideo"
                        class="pinning-video"
                        :src="pinningVideoSrc"
                        controls
                        muted
                        playsinline
                        preload="metadata"
                        :aria-label="t('gettingStarted_showIcon_videoLabel')"
                    ></video>
                </div>
            </Transition>
        </section>

        <section v-if="selectedChoice === gettingStartedChoices.typeHangul">
            <h2>{{ t("gettingStarted_about_heading") }}</h2>
            <ul class="about-list">
                <li>{{ t("gettingStarted_about_typingMode") }}</li>
                <li>{{ t("gettingStarted_about_layoutExample") }}</li>
                <li>{{ t("gettingStarted_about_romanization") }}</li>
                <li>{{ t("gettingStarted_about_notPhonetic") }}</li>
            </ul>
        </section>

        <p class="actions">
            <a :href="optionsPageHref" class="ds-btn ds-btn--secondary">{{ t("gettingStarted_openOptions") }}</a>
        </p>
    </main>
</template>

<style scoped>
.getting-started-page .intro {
    margin-top: -0.5em;
    margin-bottom: 0;
}

fieldset {
    margin: 0;
    padding: 0;
    border: 0;
}

legend {
    margin-bottom: 0.75em;
    font-size: 1.25em;
    font-weight: 700;
}

.choice-card {
    position: relative;
    display: grid;
    margin-top: 0.75em;
    /* Trailing room so a long translated label never runs under the check. */
    padding: 0.85em 2.6em 0.85em 1em;
    border: 1px solid var(--section-border);
    border-radius: var(--radius);
    cursor: pointer;
    background-color: var(--bg-primary);
}

.choice-card:hover {
    background-color: var(--button-hover-bg);
}

.choice-card.selected {
    border-color: var(--toggle-on-bg);
    background-color: var(--accent-subtle-bg);
}

/* The native radio is visually hidden (it still drives state + keyboard
   navigation), so surface keyboard focus on the card itself. */
.choice-card:has(:focus-visible) {
    outline: var(--focus-ring-width) solid var(--focus-ring-color);
    outline-offset: var(--focus-ring-offset);
}

/* Selected card's border is the accent fill — stand the focus ring off it. */
.choice-card.selected:has(:focus-visible) {
    outline-offset: var(--focus-ring-offset-filled);
}

/* Selection is the card's border + tint plus this corner check — a shape cue, so
   it doesn't lean on colour alone. */
.choice-card::after {
    content: "";
    position: absolute;
    top: 1.15em;
    right: 1.05em;
    width: 6px;
    height: 11px;
    border-right: 2px solid var(--toggle-on-bg);
    border-bottom: 2px solid var(--toggle-on-bg);
    transform: rotate(45deg) scale(0);
    transition: transform 0.12s ease;
}

.choice-card.selected::after {
    transform: rotate(45deg) scale(1);
}

.choice-card strong,
.choice-card span span {
    display: block;
}

.notice,
.error {
    margin: 1em 0 0;
    padding: 0.75em 0.9em;
    border-radius: var(--radius);
}

.notice {
    color: var(--notice-text);
    background-color: var(--notice-bg);
    border: 1px solid var(--notice-border);
}

.error {
    color: var(--error-banner-text);
    background-color: var(--error-banner-bg);
    border: 1px solid var(--error-banner-border);
}

.about-list {
    margin: 0;
    padding-left: 1.25em;
}

.about-list li + li {
    margin-top: 0.4em;
}

.pinning-video-action {
    margin: 0.85em 0 0;
}

.video-container {
    display: block;
    width: 100%;
    max-height: 360px;
    margin: 0;
    object-fit: contain;
}
.pinning-video {
    display: block;
    width: 100%;
    max-height: 360px;
    margin-top: 0.85em;
    object-fit: contain;
    background-color: light-dark(#f2f2f2, #111);
    border: 1px solid var(--section-border);
    border-radius: var(--radius);
}

.pinning-video-reveal-enter-active {
    overflow: hidden;
    transition:
        max-height 1000ms ease,
        opacity 500ms ease;
}

.pinning-video-reveal-enter-from {
    max-height: 0;
    opacity: 0;
}

.pinning-video-reveal-enter-to {
    max-height: 360px;
    opacity: 1;
}

.actions {
    margin-top: 1.5em;
    text-align: right;
}
</style>
