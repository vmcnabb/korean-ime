// Copyright © 2012-2023 Vincent McNabb

import { StateManager } from "./state-manager";
import { createMenus, setupMenuListener } from "./menus";
import { setupActionListener } from "./action";
import { ContentScriptListener } from "./content-script-listener";
import { setupGettingStartedOnInstall } from "./getting-started";
import { settingsKeys } from "../settings/settings";
import { debugLog } from "../debug-log";
import { api } from "../platform/browser-api";
import { setupPopupWindowSizeTracking } from "./popup-converter/popup-window-size";

const stateManager = new StateManager();
const contentScriptListener = new ContentScriptListener(stateManager);
contentScriptListener.listen();
setupMenuListener(stateManager);
setupActionListener(stateManager);
setupGettingStartedOnInstall();
setupPopupWindowSizeTracking();

// Create the context menus on every service-worker startup, not just on
// install. MV3 workers are ephemeral and `onInstalled` doesn't fire on a normal
// wake, which previously left the menus missing until a reload (#28).
// createMenus is idempotent (it clears first), so running it on each startup is
// safe. Keep this the single caller to avoid concurrent create collisions.
// Recreating the checkbox resets it to unchecked, so refresh the active tab's
// presentation afterwards to restore the real on-screen-keyboard state.
createMenus()
    .then(() => stateManager.refreshActiveTabPresentation())
    .catch((error) => debugLog("menu setup failed:", error));

// React to settings changes (written by the options page to storage.sync).
// Registered synchronously at the top level so it can wake an idle MV3 service
// worker. The single storage write is the broadcast — there is no explicit
// options→service-worker message (see #25/#26).
api.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "sync") {
        return;
    }
    if (!Object.keys(changes).some((key) => (settingsKeys as string[]).includes(key))) {
        return;
    }
    // The listener must stay synchronous (storage.onChanged ignores a returned
    // promise), so detach and log rather than letting a rejection surface as an
    // unhandled promise rejection in the service worker.
    stateManager.onSettingsChanged().catch((error) => debugLog("onSettingsChanged failed:", error));
});
