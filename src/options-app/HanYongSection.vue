<script setup lang="ts">
import { settings } from "./use-settings";
import { Persistence } from "../settings/settings";
import { t } from "./i18n";
import PersistenceSelect from "./PersistenceSelect.vue";
import LabeledCheckbox from "./LabeledCheckbox.vue";
import ToggleSwitch from "./ToggleSwitch.vue";
import ToggleKeySetting from "./ToggleKeySetting.vue";

const optionLabels: Record<Persistence, string> = {
    [Persistence.AlwaysOff]: t("options_hanYong_startOff"),
    [Persistence.AlwaysOn]: t("options_hanYong_startOn"),
    [Persistence.KeepLastState]: t("options_hanYong_restore"),
};
</script>

<template>
    <section>
        <div class="section-header">
            <ToggleSwitch v-model="settings.hanYong.enabled" :ariaLabel="t('options_hanYong_heading')" />
            <h2>{{ t("options_hanYong_heading") }}</h2>
        </div>
        <template v-if="settings.hanYong.enabled">
            <p class="description section-hint">{{ t("options_hanYong_hint") }}</p>
            <ToggleKeySetting />
            <LabeledCheckbox
                v-model="settings.hanYong.syncAcrossTabs"
                :label="t('options_hanYong_syncAcrossTabs_label')"
                :description="t('options_hanYong_syncAcrossTabs_description')"
            />
            <PersistenceSelect
                v-model="settings.hanYong.persistence"
                :label="t('options_persistence_label')"
                :option-labels="optionLabels"
            />
        </template>
        <p v-else class="description section-hint">{{ t("options_hanYong_disabled_hint") }}</p>
    </section>
</template>

<style scoped>
.section-header {
    display: flex;
    align-items: center;
    gap: 0.6em;
    margin-bottom: 0.75em;
}

/* The header row owns the spacing below the heading (see section-header). */
.section-header h2 {
    margin: 0;
}

.section-hint {
    margin-top: -0.25em;
    margin-bottom: 0.75em;
}
</style>
