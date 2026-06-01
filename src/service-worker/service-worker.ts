// Copyright © 2012-2023 Vincent McNabb

import { StateManager } from "./state-manager";
import { createMenus, setupMenuListener } from "./menus";
import { setupActionListener } from "./action";
import { ContentScriptListener } from "./content-script-listener";
import { settingsKeys } from "../settings/settings";
import { debugLog } from "../debug-log";

const stateManager = new StateManager();
const contentScriptListener = new ContentScriptListener(stateManager);
contentScriptListener.listen();
setupMenuListener(stateManager);
setupActionListener(stateManager);

// Create the context menus on every service-worker startup, not just on
// install. MV3 workers are ephemeral and `onInstalled` doesn't fire on a normal
// wake, which previously left the menus missing until a reload (#28).
// createMenus is idempotent (it clears first), so running it on each startup is
// safe. Keep this the single caller to avoid concurrent create collisions.
createMenus().catch((error) => debugLog("createMenus failed:", error));

// React to settings changes (written by the options page to storage.sync).
// Registered synchronously at the top level so it can wake an idle MV3 service
// worker. The single storage write is the broadcast — there is no explicit
// options→service-worker message (see #25/#26).
chrome.storage.onChanged.addListener((changes, areaName) => {
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
