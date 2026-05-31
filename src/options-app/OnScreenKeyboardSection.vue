<script setup lang="ts">
import { settings } from "./use-settings";
import PersistenceSelect from "./PersistenceSelect.vue";
</script>

<template>
    <section>
        <h2>On-screen keyboard</h2>
        <PersistenceSelect
            v-model="settings.onScreenKeyboard.persistence"
            label="Persistence between sessions"
            description="State of the on-screen keyboard when the browser starts."
        />
    </section>
</template>
