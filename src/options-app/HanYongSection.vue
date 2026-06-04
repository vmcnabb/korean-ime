<script setup lang="ts">
import { settings } from "./use-settings";
import { Persistence } from "../settings/settings";
import { t } from "./i18n";
import PersistenceSelect from "./PersistenceSelect.vue";
import LabeledCheckbox from "./LabeledCheckbox.vue";

const optionLabels: Record<Persistence, string> = {
    [Persistence.AlwaysOff]: t("options_hanYong_startOff"),
    [Persistence.AlwaysOn]: t("options_hanYong_startOn"),
    [Persistence.KeepLastState]: t("options_hanYong_restore"),
};
</script>

<template>
    <section>
        <h2>{{ t("options_hanYong_heading") }}</h2>
        <LabeledCheckbox
            v-model="settings.hanYong.enabled"
            :label="t('options_hanYong_enabled_label')"
        />
        <template v-if="settings.hanYong.enabled">
            <p class="description section-hint">{{ t("options_hanYong_hint") }}</p>
            <LabeledCheckbox
                v-model="settings.hanYong.keyboardKeyEnabled"
                :label="t('options_hanYong_keyboardKeyEnabled_label')"
                :description="t('options_hanYong_keyboardKeyEnabled_description')"
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
.section-hint {
    margin-top: -0.25em;
    margin-bottom: 0.75em;
}
</style>
