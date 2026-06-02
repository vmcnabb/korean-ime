<script setup lang="ts">
import { settings } from "./use-settings";
import { Persistence } from "../settings/settings";
import { t } from "./i18n";
import PersistenceSelect from "./PersistenceSelect.vue";

const optionLabels: Record<Persistence, string> = {
    [Persistence.AlwaysOff]: t("options_hanYong_startOff"),
    [Persistence.AlwaysOn]: t("options_hanYong_startOn"),
    [Persistence.KeepLastState]: t("options_hanYong_restore"),
};
</script>

<template>
    <section>
        <h2>{{ t("options_hanYong_heading") }}</h2>
        <p class="description section-hint">{{ t("options_hanYong_hint") }}</p>
        <PersistenceSelect
            v-model="settings.hanYong.persistence"
            :label="t('options_persistence_label')"
            :option-labels="optionLabels"
        />
    </section>
</template>

<style scoped>
.section-hint {
    margin-top: -0.25em;
    margin-bottom: 0.75em;
}
</style>
