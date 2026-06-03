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

// Chrome adds an "Options" entry to the toolbar-icon context menu automatically;
// Firefox doesn't, so we add our own there — but not on Chrome, to avoid a
// redundant duplicate of its built-in item.
//
// There's no API for the thing we actually care about ("does this browser's icon
// menu already include Options?"), so we key off the closest robust signal: the
// presence of `runtime.getBrowserInfo`, which only Firefox (and its forks)
// implement. We test for its *presence* rather than calling it — calling and
// checking `name === "Firefox"` would wrongly exclude Firefox forks (LibreWolf
// etc.), reintroducing the one failure we most want to avoid: a *missing*
// Options entry. Unlike navigator.userAgent (which Firefox's Resist
// Fingerprinting can mask), this privileged API isn't spoofed. And the bias is
// deliberate: if the signal is ever wrong, the result is a tolerable duplicate,
// never a missing item.
function lacksBuiltInOptionsMenu(): boolean {
    return typeof (api.runtime as { getBrowserInfo?: unknown } | undefined)?.getBrowserInfo === "function";
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

    if (lacksBuiltInOptionsMenu()) {
        api.contextMenus.create({
            type: "normal",
            id: menus.openOptions.id,
            title: api.i18n.getMessage(menus.openOptions.id),
            contexts: ["action"],
        });
    }
}
