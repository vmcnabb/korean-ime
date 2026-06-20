<script setup lang="ts">
import { settings } from "./use-settings";
import { Persistence } from "../settings/settings";
import { t } from "../i18n";
import SelectSetting from "./SelectSetting.vue";
import LabeledCheckbox from "./LabeledCheckbox.vue";
import ToggleSwitch from "./ToggleSwitch.vue";
import ToggleKeySetting from "./ToggleKeySetting.vue";

const persistenceOptions: { value: Persistence; name: string }[] = [
    { value: Persistence.AlwaysOff, name: t("options_hanYong_startOff") },
    { value: Persistence.AlwaysOn, name: t("options_hanYong_startOn") },
    { value: Persistence.KeepLastState, name: t("options_hanYong_restore") },
];
</script>

<template>
    <section>
        <div class="section-header">
            <ToggleSwitch v-model="settings.hanYong.enabled" :ariaLabel="t('options_hanYong_heading')" />
            <h2>{{ t("options_hanYong_heading") }}</h2>
            <p v-if="settings.hanYong.enabled" class="description section-hint">{{ t("options_hanYong_hint") }}</p>
            <p v-else class="description section-hint">{{ t("options_hanYong_disabled_hint") }}</p>
        </div>
        <template v-if="settings.hanYong.enabled">
            <div class="setting">
                <ToggleKeySetting />
            </div>
            <div class="setting">
                <LabeledCheckbox
                    v-model="settings.hanYong.syncAcrossTabs"
                    :label="t('options_hanYong_syncAcrossTabs_label')"
                    :description="t('options_hanYong_syncAcrossTabs_description')"
                />
            </div>
            <div class="setting">
                <SelectSetting
                    v-model="settings.hanYong.persistence"
                    :label="t('options_persistence_label')"
                    :options="persistenceOptions"
                />
            </div>
        </template>
    </section>
</template>

<style lang="scss" scoped>
.section-header {
    display: flex;
    align-items: center;
    gap: 0.6em;
    flex-wrap: wrap;
    margin-bottom: 0.75em;

    h2 {
        margin: 0;
        flex-grow: 1;
    }
    p {
        flex-basis: 100%;
    }
}
</style>
