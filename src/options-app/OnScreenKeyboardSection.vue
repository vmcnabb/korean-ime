<script setup lang="ts">
import { settings } from "./use-settings";
import { Persistence } from "../settings/settings";
import { LayoutId } from "../extension-state/osk-layout";
import { t } from "./i18n";
import PersistenceSelect from "./PersistenceSelect.vue";

const optionLabels: Record<Persistence, string> = {
    [Persistence.AlwaysOff]: t("options_onScreenKeyboard_startOff"),
    [Persistence.AlwaysOn]: t("options_onScreenKeyboard_startOn"),
    [Persistence.KeepLastState]: t("options_onScreenKeyboard_restore"),
};

const layoutOptions: { value: LayoutId; name: string }[] = [
    { value: LayoutId.Minimal, name: t("options_onScreenKeyboard_layout_minimal") },
    { value: LayoutId.FullUs, name: t("options_onScreenKeyboard_layout_fullUs") },
    { value: LayoutId.FullKorean, name: t("options_onScreenKeyboard_layout_fullKorean") },
];
</script>

<template>
    <section>
        <h2>{{ t("options_onScreenKeyboard_heading") }}</h2>
        <PersistenceSelect
            v-model="settings.onScreenKeyboard.persistence"
            :label="t('options_persistence_label')"
            :option-labels="optionLabels"
        />
        <label class="select">
            <span class="label">{{ t("options_onScreenKeyboard_layout_label") }}</span>
            <select v-model="settings.onScreenKeyboard.layout">
                <option v-for="option in layoutOptions" :key="option.value" :value="option.value">
                    {{ option.name }}
                </option>
            </select>
        </label>
    </section>
</template>

<style scoped>
.select {
    display: block;
    margin: 0.75em 0;
}

/* `.label` typography is shared globally in options-page.vue */
.select .label {
    display: block;
    margin-bottom: 0.25em;
}

.select select {
    font-size: 1em;
    padding: 0.25em;
}
</style>
