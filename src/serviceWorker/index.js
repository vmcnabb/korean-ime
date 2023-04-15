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

const tabStates = {};

const settings = {
    enableKeyboard: false
};

setupMenus();
loadSettings();

function loadSettings() {
    console.debug("loadSettings", settings);
    chrome.storage.sync.get(items => {
        Object.keys(settings).forEach(key => {
            if (items.hasOwnProperty(key)) {
                settings[key] = items[key];
            }
        });

        updateSettings();
    });
}

function saveSettings() {
    console.debug("saveSettings", settings);
    return new Promise(resolve => {
        chrome.storage.sync.set(settings, () => resolve());
    });
}

function updateSettings() {
    console.debug("updateSettings", settings);
    chrome.contextMenus.update(menus.onScreenKeyboard.id, { checked: settings.enableKeyboard });

    chrome.tabs.query({}, tabs => {
        tabs.forEach(tab => {
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

chrome.tabs.onUpdated.addListener((tabid, changeInfo, tab) => {
    setState(tab);
    chrome.action.enable(tabid);
});

// icon is clicked
chrome.action.onClicked.addListener(tab => {
    setState(tab, true);
});

chrome.runtime.onMessage.addListener(
    function (request, sender, sendResponse) {
        switch (request.action) {
            case "toggle":
                setState(sender.tab, true);
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

    function romanizeInPopup(event, tab) {
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

    function romanizeBeside(event, tab) {
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

    function onScreenKeyboard(event, tab) {
        settings.enableKeyboard = !settings.enableKeyboard;
        updateSettings();
        saveSettings();
    }

    chrome.contextMenus.onClicked.addListener((event, tab) => {
        switch (event.menuItemId) {
            case menus.romanizeInPopup.id:
                romanizeInPopup(event, tab);
                break;
            case menus.romanizeBeside.id:
                romanizeBeside(event, tab);
                break;
            case menus.onScreenKeyboard.id:
                onScreenKeyboard(event, tab);
                break;
        }
    });
}

function setState(tab, toggle) {
    console.debug("setState", tab, toggle);

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
