<script setup lang="ts">
import { SelectOption } from "../../options/option-types";
import { onMounted, ref, watch } from "vue";

const props = defineProps<{
  option: SelectOption,
  path: string | number
}>();

const path = String(props.path);
let model = ref(undefined);
let names = props.option.names;

async function getValue() {
    model.value = await props.option.getValue();
}
onMounted(() => {
    getValue();
});

watch(model, (newValue) => {
    props.option.setValue(newValue);
});

</script>

<template>
    <div class="option">
        <label :for="path">{{ option.title }}</label>
        <select :id="path" v-model="model">
            <option v-for="v in option.values" :value="v">{{ names[v] }}</option>
        </select>
        <p v-if="option.description !== undefined">{{ option.description }}</p>
    </div>
</template>

<style>
label {
    display: block;
}
label, select {
    font-size: 1.2em;
}
p {
    font-size: 1em;
}

.option {
    margin: 1em 0;
}
.option+.option {
    border-top: 1px solid #ccc;
    padding-top: 1em;
}
</style>
