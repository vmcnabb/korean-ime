// Copyright © 2012-2023 Vincent McNabb

import { StateManager } from "./state-manager";
import { onInstall } from "./on-install";
import { setupMenuListener } from "./menus";
import { setupActionListener } from "./action";
import { ContentScriptListener } from "./content-script-listener";
import { settingsKeys } from "../settings/settings";

chrome.runtime.onInstalled.addListener(onInstall);

const stateManager = new StateManager();
const contentScriptListener = new ContentScriptListener(stateManager);
contentScriptListener.listen();
setupMenuListener(stateManager);
setupActionListener(stateManager);

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
    stateManager.onSettingsChanged();
});
