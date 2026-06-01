<script setup lang="ts">
import { settings } from "./use-settings";
import { Persistence } from "../settings/settings";
import PersistenceSelect from "./PersistenceSelect.vue";

const optionLabels: Record<Persistence, string> = {
    [Persistence.AlwaysOff]: "Start hidden",
    [Persistence.AlwaysOn]: "Start shown",
    [Persistence.KeepLastState]: "Restore last state",
};
</script>

<template>
    <section>
        <h2>On-screen keyboard</h2>
        <PersistenceSelect
            v-model="settings.onScreenKeyboard.persistence"
            label="When the browser starts"
            :option-labels="optionLabels"
        />
    </section>
</template>
