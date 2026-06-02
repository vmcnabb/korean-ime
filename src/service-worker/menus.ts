import { romanizeBeside, romanizeInPopup } from "./romanize-menu-actions";
import { StateManager } from "./state-manager";
import { debugLog } from "../debug-log";
import { api } from "../platform/browser-api";

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
    openOptions: {
        id: "menu_openOptions",
    },
});

// Firefox doesn't add an "Options" entry to the toolbar-icon context menu the
// way Chrome does, so we add our own there — but only on Firefox, to avoid a
// redundant duplicate of Chrome's built-in item.
function isFirefox(): boolean {
    return typeof navigator !== "undefined" && navigator.userAgent.includes("Firefox");
}

export function setupMenuListener(stateManager: StateManager) {
    api.contextMenus.onClicked.addListener((event, tab) => {
        if (!tab?.id) {
            return;
        }

        switch (event.menuItemId) {
            case menus.romanizeInPopup.id:
                romanizeInPopup(event).catch((error) => debugLog("romanizeInPopup failed:", error));
                break;

            case menus.romanizeBeside.id:
                romanizeBeside(event, tab).catch((error) => debugLog("romanizeBeside failed:", error));
                break;

            case menus.onScreenKeyboard.id:
                stateManager
                    .toggleOnScreenKeyboard(tab.id)
                    .catch((error) => debugLog("toggleOnScreenKeyboard failed:", error));
                break;

            case menus.openOptions.id:
                api.runtime.openOptionsPage().catch((error) => debugLog("openOptionsPage failed:", error));
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
    await api.contextMenus.removeAll();

    api.contextMenus.create({
        type: "normal",
        id: menus.romanizeInPopup.id,
        title: api.i18n.getMessage(menus.romanizeInPopup.id),
        contexts: ["all"],
    });

    api.contextMenus.create({
        type: "normal",
        id: menus.romanizeBeside.id,
        title: api.i18n.getMessage(menus.romanizeBeside.id),
        contexts: ["editable"],
    });

    api.contextMenus.create({
        type: "checkbox",
        id: menus.onScreenKeyboard.id,
        title: api.i18n.getMessage(menus.onScreenKeyboard.id),
        contexts: ["all"],
    });

    if (isFirefox()) {
        api.contextMenus.create({
            type: "normal",
            id: menus.openOptions.id,
            title: api.i18n.getMessage(menus.openOptions.id),
            contexts: ["action"],
        });
    }
}
