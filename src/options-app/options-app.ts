import { createApp } from "vue";
import { gettingStartedView } from "../getting-started-route";
import GettingStartedPage from "./GettingStartedPage.vue";
import OptionsPage from "./options-page.vue";

// Define Vue's compile-time feature flags before the app is created. Vue's
// esm-bundler build warns when these are undefined and can't tree-shake the
// guarded code out. The options page is Composition-API-only (every SFC uses
// `<script setup>`), so the Options API can be disabled too.
declare global {
    var __VUE_OPTIONS_API__: boolean;
    var __VUE_PROD_DEVTOOLS__: boolean;
    var __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: boolean;
}

globalThis.__VUE_OPTIONS_API__ = false;
globalThis.__VUE_PROD_DEVTOOLS__ = false;
globalThis.__VUE_PROD_HYDRATION_MISMATCH_DETAILS__ = false;

const view = new URL(globalThis.location.href).searchParams.get("view");
const App = view === gettingStartedView ? GettingStartedPage : OptionsPage;

createApp(App).mount("#app");
