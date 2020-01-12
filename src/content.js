"use strict";

import { CompositionProxyFactory } from "./compositionProxyFactory";
import { HangulEditor } from "./hangulEditor";

const state = {
    isHangulMode: false,
    keyboard: {
        isEnabled: false,
        /** @type {HTMLIFrameElement} */
        element: undefined
    },
    isTopElement: window === top
};

createKeyboard();
setupListener();

function setupListener () {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        const response = { state };

        switch (request.action) {
            case 'disable':
                disable();
                break;
                
            case 'enable':
                enable();
                break;
                
            case 'state':
                break;
                
            case 'insertAfter':
                let element = getActiveElement(document);

                if (element) {
                    const compositionProxy = CompositionProxyFactory.createCompositionProxy(element);
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
                break;

            case 'enableKeyboard':
                setKeyboardEnabled(true);
                break;

            case 'disableKeyboard':
                setKeyboardEnabled(false);
                break;

            case "keyboard":
                typeKey(request.key);
                break;
        }
        sendResponse(response);
    });
}

function createKeyboard () {
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
    keyboard.height = "200px";
    keyboard.style.position = "fixed";
    keyboard.style.bottom = "0";
    keyboard.style.right = "0";
    keyboard.style.display = "none";

    document.body.appendChild(keyboard);
}

function setKeyboardEnabled (isEnabled) {
    state.keyboard.isEnabled = isEnabled;
    updateKeyboard();
}

function hideKeyboard () {
    if (state.keyboard.element) {
        state.keyboard.element.style.display = "none";
    }
}

function showKeyboard () {
    if (state.keyboard.element) {
        state.keyboard.element.style.display = "block";
    }
}

function updateKeyboard () {
    if (state.keyboard.element) {
        if (state.keyboard.isEnabled && state.isHangulMode) {
            showKeyboard();

        } else {
            hideKeyboard();

        }
    }
}

function typeKey (key) {
    const activeElement = getActiveElement(document);
    if (activeElement.hangulEditor) {
        /** HangulEditor */
        const he = activeElement.hangulEditor;
        he.addJamo(key);
    }
}

document.addEventListener(
    "keydown",
    ev => {
        if (ev.code === "AltRight" && !ev.repeat) {
            chrome.runtime.sendMessage(
                { action: "toggle" }
            );
            ev.preventDefault();
        }
    },
    true
);

function getActiveElement (doc) {
    return (doc.activeElement && doc.activeElement.contentDocument) ?
        getActiveElement(doc.activeElement.contentDocument) :
        doc.activeElement;
}

var editableElements = {};
var nextId = 0;

function processElement (el) {
    // assuming an @contenteditable, textarea, or any type of input
    if ((el.tagName.toLowerCase() === 'input' && el.type.toLowerCase() !== 'text')) return;
    
    var heId = el.dataset.heId = el.dataset.heId || nextId++;
    var ee = editableElements[heId];
    
    if (!ee) {
        var he = new HangulEditor(el);
        ee = editableElements[heId] = {
            element: el,
            editor: he
        };

        el.hangulEditor = he;
    }

    if (ee.editor.isActive() != state.isHangulMode) {
        if (state.isHangulMode)
            ee.editor.activate();
        else
            ee.editor.deactivate();
    }
}

function refreshEditableElements (doc) {
    if (!doc) return false;

    [].slice
    .call(
        doc.querySelectorAll("[contenteditable],input,textarea")
    )
    .forEach(processElement);
    
    return true;
}

var refreshInterval;
function enable () {
    if(!state.isHangulMode) {
        state.isHangulMode = true;
        refreshEditableElements(document);
        
        refreshInterval = setInterval(function() {
            refreshEditableElements(document);
        }, 400);

        updateKeyboard();
    }
}

function disable () {
    if (state.isHangulMode) {
        state.isHangulMode = false;
        clearInterval(refreshInterval);
        updateKeyboard();
        Object.keys(editableElements).forEach(key => editableElements[key].editor.deactivate());
    }
}
