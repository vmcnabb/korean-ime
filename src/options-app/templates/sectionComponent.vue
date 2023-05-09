<script setup lang="ts">
import { isSection, isSelectOption, OptionsSection, isCheckBoxOption } from "../../settings/option-types";
import SectionComponent from "./sectionComponent.vue";
import SelectComponent from "./selectComponent.vue";
import CheckBoxComponent from "./checkBoxComponent.vue";

const props = defineProps<{
  section: OptionsSection,
  path: string | number
}>();

</script>

<template>
    <div class="section">
        <h2>{{ section.title }}</h2>
        <div class="content">
            <template v-for="(option, path) in section.options">
                <SectionComponent v-if="isSection(option)" :section="option" :path="`${props.path}.${path}`"></SectionComponent>
                <SelectComponent v-else-if="isSelectOption(option)" :option="option" :path="`${props.path}.${path}`"></SelectComponent>
                <CheckBoxComponent v-else-if="isCheckBoxOption(option)" :option="option" :path="`${props.path}.${path}`"></CheckBoxComponent>
            </template>
        </div>
    </div>
</template>

<style lang="scss">
$spacing: 20px;

.section {
    margin: $spacing;
    border: 1px solid #ccc;

    .content {
        margin: $spacing;
    }
}

h2 {
    margin: 0;
    padding: calc($spacing / 2) $spacing;
    font-size: 1.5em;
    font-weight: bold;
    background-color: #e0e0e0;
}
</style>