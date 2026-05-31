<script setup lang="ts">
defineProps<{
    label: string;
    description?: string;
}>();

const model = defineModel<boolean>({ required: true });
</script>

<template>
    <label class="checkbox">
        <input v-model="model" type="checkbox" />
        <span class="label">{{ label }}</span>
        <p v-if="description" class="description">{{ description }}</p>
    </label>
</template>

<style scoped>
.checkbox {
    display: grid;
    grid-template-columns: auto 1fr;
    column-gap: 0.5em;
    align-items: baseline;
    margin: 0.75em 0;
}

/* `.label` / `.description` typography is shared globally in options-page.vue */
.checkbox .description {
    grid-column: 2;
}
</style>
