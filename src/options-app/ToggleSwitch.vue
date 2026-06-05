<script setup lang="ts">
defineProps<{
    ariaLabel: string;
}>();

const model = defineModel<boolean>({ required: true });
</script>

<template>
    <label class="switch">
        <input v-model="model" type="checkbox" :aria-label="ariaLabel" />
        <span class="slider" aria-hidden="true"></span>
    </label>
</template>

<style scoped>
.switch {
    display: inline-flex;
    flex: 0 0 auto;
    cursor: pointer;
}

/* Visually hidden but still focusable and accessible: the styled .slider is the
   visible control, the native checkbox drives state and keyboard interaction. */
.switch input {
    position: absolute;
    width: 1px;
    height: 1px;
    margin: -1px;
    padding: 0;
    border: 0;
    clip: rect(0 0 0 0);
    clip-path: inset(50%);
    overflow: hidden;
    white-space: nowrap;
}

.slider {
    position: relative;
    display: block;
    width: 2.5em;
    height: 1.4em;
    border-radius: 1em;
    background-color: var(--toggle-off-bg);
    transition: background-color 0.15s ease;
}

.slider::before {
    content: "";
    position: absolute;
    top: 0.2em;
    left: 0.2em;
    width: 1em;
    height: 1em;
    border-radius: 50%;
    background-color: #fff;
    transition: transform 0.15s ease;
}

.switch input:checked + .slider {
    background-color: var(--toggle-on-bg);
}

.switch input:checked + .slider::before {
    transform: translateX(1.1em);
}

.switch input:focus-visible + .slider {
    outline: 2px solid var(--toggle-on-bg);
    outline-offset: 2px;
}
</style>
