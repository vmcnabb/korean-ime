<script setup lang="ts">
defineProps<{
    label: string;
    description?: string;
}>();

const model = defineModel<boolean>({ required: true });
</script>

<template>
    <label class="checkbox">
        <input v-model="model" type="checkbox" class="ds-checkbox" />
        <span class="label">{{ label }}</span>
        <p v-if="description" class="description">{{ description }}</p>
    </label>
</template>

<style scoped>
.checkbox {
    display: grid;
    grid-template-columns: auto 1fr;
    column-gap: 0.5em;
    align-items: start;
    margin: 0.75em 0;
}

.checkbox .ds-checkbox {
    margin-top: 0.3em;
}

/* `.label` / `.description` typography is shared in the design system. */
.checkbox .description {
    grid-column: 2;
}
</style>
