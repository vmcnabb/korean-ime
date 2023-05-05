<script setup lang="ts">
import SectionComponent from './templates/sectionComponent.vue';
import { OptionsSection } from '../options/option-types';

const props = defineProps<{
  rootSection: OptionsSection
}>();

const sections = props.rootSection.options as ({[key: string]: OptionsSection});
</script>

<template>
    <h1>Korean IME Options</h1>
    <SectionComponent v-for="(section, key) in sections" :path="key" :section="section"></SectionComponent>
</template>

<style lang="scss">
* {
    font-family: Arial, Helvetica, sans-serif;
}

h1 {
    padding-left: calc(128px + 1em);
    background-image: url("../images/icon128.png");
    background-repeat: no-repeat;
    line-height: 128px;
    white-space: nowrap;
}
</style>
