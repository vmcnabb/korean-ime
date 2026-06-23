<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";
import { settings } from "./use-settings";
import { t } from "../i18n";
import LabeledCheckbox from "./LabeledCheckbox.vue";
import ToggleSwitch from "./ToggleSwitch.vue";
import ToggleKeySetting from "./ToggleKeySetting.vue";
import { KeyBindingUnboundEventDetail, keyBindingUnboundEvent } from "./key-binding-events";

const keyBindingFlash = ref(false);
let flashTimeout: number | undefined;

function onKeyBindingUnbound(event: Event) {
    const detail = (event as CustomEvent<KeyBindingUnboundEventDetail>).detail;
    if (detail.kind !== "hanja") {
        return;
    }

    keyBindingFlash.value = false;
    window.clearTimeout(flashTimeout);
    window.requestAnimationFrame(() => {
        keyBindingFlash.value = true;
        flashTimeout = window.setTimeout(() => {
            keyBindingFlash.value = false;
        }, 1500);
    });
}

onMounted(() => window.addEventListener(keyBindingUnboundEvent, onKeyBindingUnbound));
onUnmounted(() => {
    window.removeEventListener(keyBindingUnboundEvent, onKeyBindingUnbound);
    window.clearTimeout(flashTimeout);
});
</script>

<template>
    <section>
        <div class="section-header">
            <ToggleSwitch v-model="settings.hanja.enabled" :ariaLabel="t('options_hanja_heading')" />
            <h2>{{ t("options_hanja_heading") }}</h2>
            <p v-if="settings.hanja.enabled" class="description section-hint">{{ t("options_hanja_hint") }}</p>
            <p v-else class="description section-hint">{{ t("options_hanja_disabled_hint") }}</p>
        </div>
        <template v-if="settings.hanja.enabled">
            <div class="setting" :class="{ 'key-binding-flash': keyBindingFlash }">
                <ToggleKeySetting kind="hanja" />
            </div>
            <div class="setting">
                <LabeledCheckbox
                    v-model="settings.hanja.showSimplified"
                    :label="t('options_hanja_showSimplified_label')"
                    :description="t('options_hanja_showSimplified_description')"
                />
            </div>
            <div class="setting">
                <LabeledCheckbox
                    v-model="settings.hanja.showPinyin"
                    :label="t('options_hanja_showPinyin_label')"
                    :description="t('options_hanja_showPinyin_description')"
                />
            </div>
        </template>
    </section>
</template>

<style lang="scss" scoped>
.section-header {
    display: flex;
    align-items: center;
    gap: 0.6em;
    flex-wrap: wrap;
    margin-bottom: 0.75em;

    h2 {
        margin: 0;
        flex-grow: 1;
    }
    p {
        flex-basis: 100%;
    }
}
</style>
