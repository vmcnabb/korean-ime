import { createApp } from "vue";
import App from "./options-page.vue";
import { getAvailableOptions } from "../options/option-definitions";

start();

async function start() {
    const app = createApp(App, {
        rootSection: getAvailableOptions()
    });

    app.mount("#app");
}
