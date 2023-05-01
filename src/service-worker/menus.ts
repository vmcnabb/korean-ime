import { romanizeBeside, romanizeInPopup } from "./romanize-menu-actions";
import { StateManager } from "./state-manager";

export const menus = Object.freeze({
    "onScreenKeyboard": {
        id: "menu_onScreenKeyboard"
    },
    "romanizeInPopup": {
        id: "menu_romanizeInPopup"
    },
    "romanizeBeside": {
        id: "menu_romanizeBeside"
    }
});

export function setupMenuListener() {
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
                StateManager.instance.toggleOnScreenKeyboard(tab.id);
                break;
        }
    });
}

export function createMenus() {
    chrome.contextMenus.create({
        type: 'normal',
        id: menus.romanizeInPopup.id,
        title: chrome.i18n.getMessage(menus.romanizeInPopup.id),
        contexts: ['all']
    });

    chrome.contextMenus.create({
        type: 'normal',
        id: menus.romanizeBeside.id,
        title: chrome.i18n.getMessage(menus.romanizeBeside.id),
        contexts: ['editable']
    });

    chrome.contextMenus.create({
        type: "checkbox",
        id: menus.onScreenKeyboard.id,
        title: chrome.i18n.getMessage(menus.onScreenKeyboard.id),
        contexts: ['all']
    });
}
