<script setup lang="ts">
import { computed } from "vue";
import { Persistence } from "../settings/settings";

const props = defineProps<{
    label: string;
    // Display text for each persistence value, supplied per feature so the
    // wording can be specific (e.g. "Start in Hangul" vs "Start shown").
    optionLabels: Record<Persistence, string>;
    description?: string;
}>();

const model = defineModel<Persistence>({ required: true });

// Fixed order, names from the per-feature prop.
const options = computed(() => [
    { value: Persistence.AlwaysOff, name: props.optionLabels[Persistence.AlwaysOff] },
    { value: Persistence.AlwaysOn, name: props.optionLabels[Persistence.AlwaysOn] },
    { value: Persistence.KeepLastState, name: props.optionLabels[Persistence.KeepLastState] },
]);
</script>

<template>
    <label class="select">
        <span class="label">{{ label }}</span>
        <select v-model="model" class="ds-field ds-field--compact">
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

/* `.label` / `.description` typography is shared in the design system. */
.select .label {
    display: block;
    margin-bottom: 0.25em;
}
</style>
