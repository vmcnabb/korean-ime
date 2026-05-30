import { createApp } from "vue";
import App from "./options-page.vue";
import { getSettings } from "../settings/settings-factory";

start();

async function start() {
    const { settings, settingsStore, settingsManager, addSettingsUpdateListener } = await getSettings();

    const app = createApp(App, {
        rootSection: settings,
        settingsStore,
        settingsManager,
        addSettingsUpdateListener,
    });

    app.mount("#app");
}
