<script setup lang="ts">
import { Persistence } from "../settings/settings";

defineProps<{
    label: string;
    description?: string;
}>();

const model = defineModel<Persistence>({ required: true });

const options: { value: Persistence; name: string }[] = [
    { value: Persistence.AlwaysOff, name: "Always off" },
    { value: Persistence.AlwaysOn, name: "Always on" },
    { value: Persistence.KeepLastState, name: "Keep last state" },
];
</script>

<template>
    <label class="select">
        <span class="label">{{ label }}</span>
        <select v-model="model">
            <option v-for="option in options" :key="option.value" :value="option.value">
                {{ option.name }}
            </option>
        </select>
        <p v-if="description" class="description">{{ description }}</p>
    </label>
</template>

<style scoped>
.select {
    display: block;
    margin: 0.75em 0;
}

/* `.label` / `.description` typography is shared globally in options-page.vue */
.select .label {
    display: block;
    margin-bottom: 0.25em;
}

.select select {
    font-size: 1em;
    padding: 0.25em;
}
</style>
