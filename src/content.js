"use strict";

import { CompositionAdapterFactory } from "./compositionAdapterFactory";
import { HangulImeController } from "./hangulImeController";

const state = {
    isHangulMode: false,
    keyboard: {
        isEnabled: false,
        /** @type {HTMLIFrameElement} */
        element: undefined,
        placement: {
            originX: "right",
            originY: "bottom",
            x: 0,
            y: 0
        }
    },
    isTopElement: window === top
};

createKeyboard();
setupListener();

function setupListener() {
    const actions = {
        disable: disable,
        enable: enable,
        state: () => { },
        insertAfter: (request, response) => {
            let element = getActiveElement(document);

            if (element) {
                const compositionProxy = CompositionAdapterFactory.createCompositionAdapter(element);
                if (compositionProxy) {
                    compositionProxy.deselect();
                    compositionProxy.updateComposition(request.data);
                    compositionProxy.deselect();
                    response.wasSuccessful = true;
                } else {
                    response.wasSuccessful = false;
                }
            } else {
                response.wasSuccessful = false;
            }
        },
        enableKeyboard: () => setKeyboardEnabled(true),
        disableKeyboard: () => setKeyboardEnabled(false),
        keyboard: (request) => typeKey(request.key),
        moveKeyboard: (request) => moveKeyboard(request.dx, request.dy),
    };

    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        const response = { state };

        const action = actions[request.action];
        if (action) {
            action(request, response);
        }

        sendResponse(response);
    });
}


function placeKeyboard() {
    if (state.isTopElement) {
        // get x,y coordinates of keyboard based on an origin of Top Left
        const placement = state.keyboard.placement;
        const width = state.keyboard.element.offsetWidth;
        const height = state.keyboard.element.offsetHeight;

        let x = placement.originX === "right" ?
            window.innerWidth - width - placement.x :
            placement.x;

        let y = placement.originY === "bottom" ?
            window.innerHeight - height - placement.y :
            placement.y;

        // try to make sure keyboard is not partially off screen
        if (x < 0) x = 0;
        if (y < 0) y = 0;

        if (x + width > window.innerWidth) x = window.innerWidth - width;
        if (y + height > window.innerHeight) y = window.innerHeight - height;

        // find out which quandrant keyboard is in and set appropriate origin
        const cx = ~~(x + width / 2);
        const cy = ~~(y + height / 2);

        const originX = cx > window.innerWidth / 2 ?
            "right" :
            "left";

        const originY = cy > window.innerHeight / 2 ?
            "bottom" :
            "top";

        // set x and y based on new origin
        const keyboardElement = state.keyboard.element;
        if (originX === "right") {
            x = window.innerWidth - x - width;
            keyboardElement.style.left = "";
            keyboardElement.style.right = `${x}px`;

        } else {
            keyboardElement.style.left = `${x}px`;
            keyboardElement.style.right = "";
        }

        if (originY === "bottom") {
            y = window.innerHeight - y - height;
            keyboardElement.style.top = "";
            keyboardElement.style.bottom = `${y}px`;

        } else {
            keyboardElement.style.top = `${y}px`;
            keyboardElement.style.bottom = "";
        }

        placement.x = x;
        placement.y = y;
        placement.originX = originX;
        placement.originY = originY;
    }
}

function moveKeyboard(dx, dy) {
    if (state.isTopElement) {
        const kb = state.keyboard;

        const kx = parseInt(kb.placement.x);
        const ky = parseInt(kb.placement.y);

        if (kb.placement.originX === "right") {
            dx = -dx;
        }

        if (kb.placement.originY === "bottom") {
            dy = -dy;
        }

        kb.placement.x = kx + dx;
        kb.placement.y = ky + dy;

        placeKeyboard();
    }
}

function createKeyboard() {
    if (!state.isTopElement) {
        return;
    }

    if (state.keyboard.element) {
        throw "createKeyboard() must only be called once.";
    }

    const keyboard = document.createElement("iframe");
    state.keyboard.element = keyboard;

    keyboard.src = chrome.runtime.getURL("popupKeyboard/index.html");
    keyboard.width = "480px";
    keyboard.height = "203px";
    keyboard.style.position = "fixed";
    keyboard.style.bottom = "0";
    keyboard.style.right = "0";
    keyboard.style.display = "none";
    keyboard.style.border = "none";
    keyboard.style.zIndex = "9999";

    document.body.appendChild(keyboard);
}

function setKeyboardEnabled(isEnabled) {
    state.keyboard.isEnabled = isEnabled;
    updateKeyboard();
}

function hideKeyboard() {
    if (state.keyboard.element) {
        state.keyboard.element.style.display = "none";
    }
}

function showKeyboard() {
    if (state.keyboard.element) {
        state.keyboard.element.style.display = "block";
        placeKeyboard();
    }
}

function updateKeyboard() {
    if (state.keyboard.element) {
        if (state.keyboard.isEnabled) {
            showKeyboard();

        } else {
            hideKeyboard();

        }
    }
}

function typeKey(key) {
    const activeElement = getActiveElement(document);
    if (activeElement.hangulEditor) {
        /** HangulEditor */
        const he = activeElement.hangulEditor;
        he.addJamo(key);
    }
}

document.addEventListener(
    "keydown",
    e => {
        if (e.code === "AltRight" && !e.repeat) {
            chrome.runtime.sendMessage(
                { action: "toggle" }
            );
            e.preventDefault();
        }
    },
    true
);

function getActiveElement(doc) {
    return (doc.activeElement && doc.activeElement.contentDocument) ?
        getActiveElement(doc.activeElement.contentDocument) :
        doc.activeElement;
}

/**
 * @type {Map<HTMLElement, HangulImeController>}
 */
var imeControllers = new Map();

/**
 * @param {HTMLElement} element 
 */
function processElement(element) {
    let imeController = imeControllers.get(element);

    if (!imeController) {
        imeController = new HangulImeController(element);
        imeControllers.set(element, imeController);
    }

    if (imeController.isActive() != state.isHangulMode) {
        if (state.isHangulMode) {
            imeController.activate();
        } else {
            imeController.deactivate();
        }
    }
}

function refreshTextInputElements(doc) {
    if (!doc) {
        return false;
    }

    Array.prototype.slice
        .call(
            doc.querySelectorAll("[contenteditable],input[type=text],textarea")
        )
        .forEach(processElement);

    return true;
}

let refreshInterval;
function enable() {
    if (state.isHangulMode) {
        return;
    }

    state.isHangulMode = true;

    // probably not necessary but just in case
    clearInterval(refreshInterval);
    refreshTextInputElements(document);

    refreshInterval = setInterval(function () {
        refreshTextInputElements(document);
    }, 400);

    updateKeyboard();
}

function disable() {
    if (!state.isHangulMode) {
        return;
    }

    state.isHangulMode = false;
    clearInterval(refreshInterval);
    updateKeyboard();

    imeControllers.values.forEach(imeController => imeController.deactivate());
}
