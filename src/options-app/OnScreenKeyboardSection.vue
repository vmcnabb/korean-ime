<script setup lang="ts">
import { settings } from "./use-settings";
import { Persistence } from "../settings/settings";
import { t } from "./i18n";
import PersistenceSelect from "./PersistenceSelect.vue";

const optionLabels: Record<Persistence, string> = {
    [Persistence.AlwaysOff]: t("options_onScreenKeyboard_startOff"),
    [Persistence.AlwaysOn]: t("options_onScreenKeyboard_startOn"),
    [Persistence.KeepLastState]: t("options_onScreenKeyboard_restore"),
};
</script>

<template>
    <section>
        <h2>{{ t("options_onScreenKeyboard_heading") }}</h2>
        <PersistenceSelect
            v-model="settings.onScreenKeyboard.persistence"
            :label="t('options_persistence_label')"
            :option-labels="optionLabels"
        />
    </section>
</template>
