<script setup lang="ts">
import { settings } from "./use-settings";
import { Persistence } from "../settings/settings";
import { LayoutId } from "../extension-state/osk-layout";
import { t } from "./i18n";
import SelectSetting from "./SelectSetting.vue";
import LabeledCheckbox from "./LabeledCheckbox.vue";

const persistenceOptions: { value: Persistence; name: string }[] = [
    { value: Persistence.AlwaysOff, name: t("options_onScreenKeyboard_startOff") },
    { value: Persistence.AlwaysOn, name: t("options_onScreenKeyboard_startOn") },
    { value: Persistence.KeepLastState, name: t("options_onScreenKeyboard_restore") },
];

const layoutOptions: { value: LayoutId; name: string }[] = [
    { value: LayoutId.Minimal, name: t("options_onScreenKeyboard_layout_minimal") },
    { value: LayoutId.FullUs, name: t("options_onScreenKeyboard_layout_fullUs") },
    { value: LayoutId.FullKorean, name: t("options_onScreenKeyboard_layout_fullKorean") },
];
</script>

<template>
    <section>
        <h2>{{ t("options_onScreenKeyboard_heading") }}</h2>
        <div class="setting">
            <SelectSetting
                v-model="settings.onScreenKeyboard.persistence"
                :label="t('options_persistence_label')"
                :options="persistenceOptions"
            />
        </div>
        <div class="setting">
            <LabeledCheckbox
                v-model="settings.onScreenKeyboard.syncAcrossTabs"
                :label="t('options_onScreenKeyboard_syncAcrossTabs_label')"
                :description="t('options_onScreenKeyboard_syncAcrossTabs_description')"
            />
        </div>
        <div class="setting">
            <SelectSetting
                v-model="settings.onScreenKeyboard.layout"
                :label="t('options_onScreenKeyboard_layout_label')"
                :options="layoutOptions"
                select-class="keyboard-layout-select"
            />
        </div>
    </section>
</template>

<style scoped>
.keyboard-layout-select {
    --ds-field-select-width: 20rem;
}
</style>
