import { romanizeBeside, romanizeInPopup } from "./romanize-menu-actions";
import { StateManager } from "./state-manager";

export const menus = Object.freeze({
    onScreenKeyboard: {
        id: "menu_onScreenKeyboard",
    },
    romanizeInPopup: {
        id: "menu_romanizeInPopup",
    },
    romanizeBeside: {
        id: "menu_romanizeBeside",
    },
});

export function setupMenuListener(stateManager: StateManager) {
    chrome.contextMenus.onClicked.addListener((event, tab) => {
        if (!tab?.id) {
            return;
        }

        switch (event.menuItemId) {
            case menus.romanizeInPopup.id:
                romanizeInPopup(event);
                break;

            case menus.romanizeBeside.id:
                romanizeBeside(event, tab);
                break;

            case menus.onScreenKeyboard.id:
                stateManager.toggleOnScreenKeyboard(tab.id);
                break;
        }
    });
}

/**
 * (Re)create the context menus. Idempotent: clears any existing items first, so
 * it's safe to call on every service-worker startup.
 *
 * MV3 service workers are ephemeral and `onInstalled` only fires on
 * install/update — not on a normal wake — so creating menus there alone left
 * them missing whenever the worker started for any other reason (#28). Call this
 * from a single top-level site instead. Keep it a single caller: two concurrent
 * removeAll-then-create sequences can still collide on duplicate ids.
 */
export async function createMenus() {
    await chrome.contextMenus.removeAll();

    chrome.contextMenus.create({
        type: "normal",
        id: menus.romanizeInPopup.id,
        title: chrome.i18n.getMessage(menus.romanizeInPopup.id),
        contexts: ["all"],
    });

    chrome.contextMenus.create({
        type: "normal",
        id: menus.romanizeBeside.id,
        title: chrome.i18n.getMessage(menus.romanizeBeside.id),
        contexts: ["editable"],
    });

    chrome.contextMenus.create({
        type: "checkbox",
        id: menus.onScreenKeyboard.id,
        title: chrome.i18n.getMessage(menus.onScreenKeyboard.id),
        contexts: ["all"],
    });
}
