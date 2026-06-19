<script setup lang="ts" generic="T extends string | number">
defineProps<{
    label: string;
    options: { value: T; name: string }[];
    description?: string;
    selectClass?: string;
}>();

const model = defineModel<T>({ required: true });
</script>

<template>
    <label class="select">
        <span class="label">{{ label }}</span>
        <select v-model="model" class="ds-field ds-field--compact ds-field--select" :class="selectClass">
            <option v-for="option in options" :key="String(option.value)" :value="option.value">
                {{ option.name }}
            </option>
        </select>
        <p v-if="description" class="description">{{ description }}</p>
    </label>
</template>

<style scoped>
.select {
    display: block;
}

/* `.label` / `.description` typography is shared in the design system. */
.select .label {
    display: block;
}
</style>
