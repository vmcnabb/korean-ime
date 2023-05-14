<script setup lang="ts">
import { EnumLike } from "../../types/enums";
import { SelectOption } from "../../settings/option-types";
import { computed } from "vue";

const props = defineProps<{
    option: SelectOption<EnumLike>;
    path: string | number;
}>();

const path = String(props.path);
const names = props.option.names;

const model = computed({
    get: () => props.option.value,
    set: (newValue: string | number) => {
        props.option.value = newValue;
    },
});
</script>

<template>
    <div class="option">
        <label :for="path">{{ option.title }}</label>
        <select :id="path" v-model="model">
            <option v-for="v in option.values" :value="v">
                {{ names[v] }}
            </option>
        </select>
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
