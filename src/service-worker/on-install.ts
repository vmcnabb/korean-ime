import { createMenus } from "./menus";
import { debugLog } from "../debug-log";

export function onInstall(_details: chrome.runtime.InstalledDetails): void {
    debugLog("onInstall _details: ", _details);
    createMenus();
}
