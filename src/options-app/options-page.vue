<script setup lang="ts">
import { onMounted } from "vue";
import { initSettings, settings } from "./use-settings";
import { t } from "./i18n";
import OnScreenKeyboardSection from "./OnScreenKeyboardSection.vue";
import HanYongSection from "./HanYongSection.vue";
import LabeledCheckbox from "./LabeledCheckbox.vue";

onMounted(initSettings);
</script>

<template>
    <main>
        <h1>{{ t("options_title") }}</h1>
        <OnScreenKeyboardSection />
        <HanYongSection />
        <section>
            <h2>{{ t("options_general_heading") }}</h2>
            <LabeledCheckbox
                v-model="settings.shareAcrossTabs"
                :label="t('options_shareAcrossTabs_label')"
                :description="t('options_shareAcrossTabs_description')"
            />
        </section>
    </main>
</template>

<style>
body {
    margin: 0;
    font-family: Arial, Helvetica, sans-serif;
    color: #1a1a1a;
}

main {
    max-width: 640px;
    margin: 0 auto;
    padding: 0 1.5em 2em;
}

h1 {
    padding-left: calc(128px + 1em);
    background-image: url("../images/icon128.png");
    background-repeat: no-repeat;
    line-height: 128px;
    white-space: nowrap;
}

section {
    margin-top: 1.5em;
    padding: 1em 1.25em;
    border: 1px solid #ddd;
    border-radius: 8px;
}

section h2 {
    margin: 0 0 0.75em;
    font-size: 1.25em;
}

/* Shared by LabeledCheckbox and PersistenceSelect (intentionally not scoped). */
.label {
    font-size: 1.1em;
}

.description {
    margin: 0.15em 0 0;
    font-size: 0.9em;
    color: #666;
}
</style>
