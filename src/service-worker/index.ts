// Copyright © 2012-2023 Vincent McNabb

import { StateManager } from "./state-manager";
import { onInstall } from "./on-install";
import { setupMenuListener } from "./menus";
import { setupActionListener } from "./action";
import { ContentScriptListener } from "./content-script-listener";

chrome.runtime.onInstalled.addListener(onInstall);

StateManager.instance;
ContentScriptListener.instance.listen();
setupMenuListener();
setupActionListener();
