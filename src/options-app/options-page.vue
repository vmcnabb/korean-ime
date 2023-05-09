<script setup lang="ts">
import SectionComponent from './templates/sectionComponent.vue';
import { OptionsSection } from '../settings/option-types';
import { SettingsStore } from '../settings/default-settings';
import { SettingsManager } from '../settings/settings-manager';
import { SettingsChangedCallback } from '../settings/process-settings';

const props = defineProps<{
    rootSection: OptionsSection,
    settingsStore: SettingsStore,
    settingsManager: SettingsManager<SettingsStore>,
    addSettingsUpdateListener: (callback: SettingsChangedCallback) => void
}>();

const sections = props.rootSection.options as ({[key: string]: OptionsSection});

props.addSettingsUpdateListener((_path, _previousValue, _newValue) => {
    props.settingsManager.saveSettings(props.settingsStore);
});

</script>

<template>
    <h1>{{ rootSection.title }}</h1>
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
