<script setup lang="ts">
import { settings } from "./use-settings";
import { Persistence } from "../settings/settings";
import PersistenceSelect from "./PersistenceSelect.vue";

const optionLabels: Record<Persistence, string> = {
    [Persistence.AlwaysOff]: "Start in Latin",
    [Persistence.AlwaysOn]: "Start in Hangul",
    [Persistence.KeepLastState]: "Restore last mode",
};
</script>

<template>
    <section>
        <h2>Han/Yong (한/영) toggle</h2>
        <p class="description section-hint">Switches between Hangul and Latin input.</p>
        <PersistenceSelect
            v-model="settings.hanYong.persistence"
            label="When the browser starts"
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
