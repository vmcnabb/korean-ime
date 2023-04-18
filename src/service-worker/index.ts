// Copyright © 2012-2023 Vincent McNabb

"use strict";

import { romanize } from "../romanize";

const menus = {
    "onScreenKeyboard": {
        id: "menu_onScreenKeyboard"
    },
    "romanizeInPopup": {
        id: "menu_romanizeInPopup"
    },
    "romanizeBeside": {
        id: "menu_romanizeBeside"
    }
}

type TabState = {
    enabled: boolean;
};

const tabStates: {[x: number]: TabState} = {};

const settings = {
    enableKeyboard: false
};

chrome.runtime.onInstalled.addListener(() => {
    setupMenus();
});

loadSettings();

function loadSettings() {
    console.debug("loadSettings", settings);
    chrome.storage.sync.get(items => {
        Object.keys(settings).forEach(key => {
            // hack for now
            const k = key as keyof typeof settings;

            if (items.hasOwnProperty(key)) {
                settings[k] = items[key];
            }
        });

        updateSettings();
    });
}

function saveSettings() {
    console.debug("saveSettings", settings);
    return new Promise(resolve => {
        chrome.storage.sync.set(settings, () => resolve(undefined));
    });
}

function updateSettings() {
    console.debug("updateSettings", settings);
    chrome.contextMenus.update(menus.onScreenKeyboard.id, { checked: settings.enableKeyboard });

    chrome.tabs.query({}, tabs => {
        tabs.forEach(tab => {
            if (!tab.id) {
                return;
            }

            chrome.tabs
                .sendMessage(tab.id, {
                    action: settings.enableKeyboard ? "enableKeyboard" : "disableKeyboard"
                })
                .catch(e => {
                    console.debug("error sending message to tab", e);
                });
        });
    });
}

// icon is clicked
chrome.action.onClicked.addListener(tab => {
    toggleActive(tab, true);
});

chrome.runtime.onMessage.addListener(
    function (request, sender, sendResponse) {
        console.debug("onMessage", request, sender);

        switch (request.action) {
            case "toggle":
                if (!sender.tab) {
                    break;
                }
                toggleActive(sender.tab, true);
                sendResponse({ status: "accepted" });
                break;
        }
    }
);

function setupMenus() {
    console.debug("setupMenus");

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

    console.debug("creating on-screen keyboard menu item");
    chrome.contextMenus.create({
        type: "checkbox",
        id: menus.onScreenKeyboard.id,
        title: chrome.i18n.getMessage(menus.onScreenKeyboard.id),
        contexts: ['all']
    });

    function romanizeInPopup(event: chrome.contextMenus.OnClickData) {
        const selectionText = event.selectionText || "";
        const romanText = romanize(selectionText);

        // put text into popup window
        chrome.windows.create(
            {
                url: 'popup-converter/popup-converter.html',
                type: 'popup',
                width: 600,
                height: 400
            },
            function (newWindow) {
                setTimeout(() => {
                    if (!newWindow?.tabs || !newWindow.tabs[0].id) return;

                    chrome.tabs.sendMessage(
                        newWindow.tabs[0].id,
                        {
                            action: 'fill',
                            original: selectionText,
                            roman: romanText
                        }
                    );
                }, 100);
            }
        );
    }

    function romanizeBeside(event: chrome.contextMenus.OnClickData, tab: chrome.tabs.Tab | undefined) {
        if (!tab || !tab.id || !event.selectionText) return;

        const romanText = romanize(event.selectionText);

        if (event.editable) {
            // insert the romanized text after the hangul
            chrome.tabs.sendMessage(
                tab.id,
                {
                    action: 'insertAfter',
                    data: romanText
                }
            );

        } else {
            // put text into popup window
            chrome.windows.create(
                {
                    url: 'popup-converter/popup-converter.html',
                    type: 'popup',
                    width: 600,
                    height: 400
                },
                function (window) {
                    setTimeout(() => {
                        if (!window?.tabs || !window.tabs[0].id) return;

                        chrome.tabs.sendMessage(
                            window.tabs[0].id,
                            {
                                action: 'fill',
                                original: event.selectionText,
                                roman: romanText
                            }
                        );
                    }, 100);
                }
            );
        }
    }

    function toggleOnScreenKeyboard() {
        settings.enableKeyboard = !settings.enableKeyboard;
        updateSettings();
        saveSettings();
    }

    chrome.contextMenus.onClicked.addListener((event, tab) => {
        switch (event.menuItemId) {
            case menus.romanizeInPopup.id:
                romanizeInPopup(event);
                break;
            case menus.romanizeBeside.id:
                romanizeBeside(event, tab);
                break;
            case menus.onScreenKeyboard.id:
                toggleOnScreenKeyboard();
                break;
        }
    });
}

function toggleActive(tab: chrome.tabs.Tab, toggle: boolean) {
    console.debug("setState", tab, toggle);

    if (!tab.id) return;

    var tabState = tabStates[tab.id] = tabStates[tab.id] || { enabled: false };

    if (toggle) tabState.enabled = !tabState.enabled;

    chrome.action.setIcon({
        tabId: tab.id,
        path: tabState.enabled ? 'images/icon16h.png' : 'images/icon16a.png'
    });

    chrome.tabs
        .sendMessage(tab.id, {
            action: tabState.enabled ? 'enable' : 'disable'
        })
        .catch((e) => {
            console.debug("Failed to send message to tab", tab.id, e);
        });

    chrome.tabs
        .sendMessage(tab.id, {
            action: settings.enableKeyboard ? "enableKeyboard" : "disableKeyboard"
        })
        .catch((e) => {
            console.debug("Failed to send message to tab", tab.id, e);
        });
}
