import { createMenus } from "./menus";

export function onInstall(_details: chrome.runtime.InstalledDetails): void {
    console.debug("onInstall _details: ", _details);
    createMenus();
}
