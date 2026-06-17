<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from "vue";
import { currentKeyBindingPlatform } from "../keyboard/key-binding";
import { api } from "../platform/browser-api";
import { GettingStartedChoice, gettingStartedChoices } from "./getting-started-model";
import { t } from "./i18n";
import { initSettings, settings } from "./use-settings";
import pinDarkVideo from "url:../videos/pin-dark.mp4";
import pinLightVideo from "url:../videos/pin-light.mp4";

const loading = ref(true);
const errorMessage = ref("");
const typeHangulInput = ref<HTMLInputElement>();
const otherToolsInput = ref<HTMLInputElement>();
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
const gettingStartedNoticeKey = computed(() =>
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
        await nextTick();
        focusInitialChoice();
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

function focusInitialChoice(): void {
    if (selectedChoice.value === gettingStartedChoices.otherTools) {
        otherToolsInput.value?.focus();
        return;
    }

    typeHangulInput.value?.focus();
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
                        ref="typeHangulInput"
                        type="radio"
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
                        ref="otherToolsInput"
                        type="radio"
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
                    class="show-pinning-video"
                    type="button"
                    :aria-controls="pinningVideoId"
                    @click="revealPinningVideo"
                >
                    {{ t("gettingStarted_showIcon_showVideo") }}
                </button>
            </p>
            <Transition name="pinning-video-reveal">
                <video
                    v-if="showPinningVideo"
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
            <a :href="optionsPageHref">{{ t("gettingStarted_openOptions") }}</a>
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
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 0.75em;
    align-items: start;
    margin-top: 0.75em;
    padding: 0.85em 1em;
    border: 1px solid var(--section-border);
    border-radius: 8px;
    cursor: pointer;
    background-color: var(--bg-primary);
}

.choice-card.selected {
    border-color: var(--toggle-on-bg);
    box-shadow: 0 0 0 1px var(--toggle-on-bg);
}

.choice-card input {
    margin-top: 0.15em;
}

.choice-card strong,
.choice-card span span {
    display: block;
}

.notice,
.error {
    margin: 1em 0 0;
    padding: 0.75em 0.9em;
    border-radius: 8px;
}

.notice {
    color: light-dark(#243b1e, #d7f5cb);
    background-color: light-dark(#edf8e8, #1f3219);
    border: 1px solid light-dark(#b9daa8, #476b38);
}

.error {
    color: light-dark(#6b1f1f, #ffdede);
    background-color: light-dark(#fff0f0, #3a1717);
    border: 1px solid light-dark(#e3aaaa, #8a3b3b);
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

.show-pinning-video {
    padding: 0.55em 0.8em;
    font: inherit;
    font-weight: 700;
    color: white;
    background-color: var(--toggle-on-bg);
    border: 1px solid var(--toggle-on-bg);
    border-radius: 6px;
    cursor: pointer;
}

.show-pinning-video:hover,
.show-pinning-video:focus-visible {
    filter: brightness(1.08);
}

.pinning-video {
    display: block;
    width: 100%;
    max-height: 360px;
    margin-top: 0.85em;
    object-fit: contain;
    background-color: light-dark(#f2f2f2, #111);
    border: 1px solid var(--section-border);
    border-radius: 8px;
}

.pinning-video-reveal-enter-active {
    overflow: hidden;
    transition:
        max-height 180ms ease,
        opacity 180ms ease;
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
