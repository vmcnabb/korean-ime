<script setup lang="ts">
import { onMounted } from "vue";
import { initSettings } from "./use-settings";
import { t } from "./i18n";
import OnScreenKeyboardSection from "./OnScreenKeyboardSection.vue";
import HanYongSection from "./HanYongSection.vue";

onMounted(initSettings);
</script>

<template>
    <main class="options-page">
        <h1>{{ t("options_title") }}</h1>
        <HanYongSection />
        <OnScreenKeyboardSection />
    </main>
</template>

<!-- Design tokens, base typography and the .label / .description utility text
     are shared in src/styles/design-system.css (imported in options-app.ts).
     This file keeps only the options-app layout. The section card and heading
     rules are element selectors so the child-component <section>s and the
     getting-started page pick them up too. -->
<style>
body {
    margin: 0;
}

main {
    max-width: 640px;
    margin: 0 auto;
    padding: 0 1.5em 2em;
}

h1 {
    --page-heading-icon-size: 128px;

    display: flex;
    align-items: center;
    min-height: var(--page-heading-icon-size);
    padding-left: calc(var(--page-heading-icon-size) + 1em);
    /* image-set serves the 2x logo on HiDPI / zoom; the plain url() and the
       -webkit- form are fallbacks for older engines. */
    background-image: url("../images/icon128.png");
    background-image: -webkit-image-set(url("../images/icon128.png") 1x, url("../images/icon256.png") 2x);
    background-image: image-set(url("../images/icon128.png") 1x, url("../images/icon256.png") 2x);
    background-repeat: no-repeat;
    background-position: left center;
    background-size: var(--page-heading-icon-size) var(--page-heading-icon-size);
    line-height: 1.15;
}

.options-page h1,
.getting-started-page h1 {
    --page-heading-icon-size: 64px;

    margin: 1.2em 0 1em;
    font-size: 1.75em;
}

section {
    margin-top: 1.5em;
    padding: 1em 1.25em;
    background-color: var(--section-bg);
    border: 1px solid var(--section-border);
    border-radius: var(--radius);
}

section h2 {
    margin: 0 0 0.75em;
    font-size: 1.25em;
}

div.setting {
    margin-top: 1.5em;
    border-top: 1px solid var(--section-border);
    padding-top: 0.75em;
}
</style>
