<script setup lang="ts">
import { CheckboxOption } from "../../settings/option-types";
import { computed } from "vue";

const props = defineProps<{
    option: CheckboxOption;
    path: string | number;
}>();

const path = String(props.path);

const model = computed({
    get: () => props.option.value,
    set: (newValue) => {
        props.option.value = newValue;
    },
});
</script>

<template>
    <div class="checkbox option">
        <label :for="path">
            <input type="checkbox" :id="path" v-model="model" />
            {{ option.title }}
        </label>
        <p v-if="option.description !== undefined">{{ option.description }}</p>
    </div>
</template>

<style>
label {
    display: block;
}
label,
select {
    font-size: 1.2em;
}
p {
    font-size: 1em;
}

.option {
    margin: 1em 0;
}
.option + .option {
    border-top: 1px solid #ccc;
    padding-top: 1em;
}
</style>
