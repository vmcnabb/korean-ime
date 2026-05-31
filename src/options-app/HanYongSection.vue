<script setup lang="ts">
import { settings } from "./use-settings";
import PersistenceSelect from "./PersistenceSelect.vue";
</script>

<template>
    <section>
        <h2>Han/Yong (한/영) toggle</h2>
        <PersistenceSelect
            v-model="settings.hanYong.persistence"
            label="Persistence between sessions"
            description="State of the Han/Yong toggle when the browser starts."
        />
    </section>
</template>
