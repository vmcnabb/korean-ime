// Copyright © 2012-2018 Vincent McNabb
import { SelectionEditorFactory } from "./selectionEditorFactory.js";
import { HangulEditor } from "./hangulEditor.js";

const state = {
    enabled: false
};

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
                const sel = SelectionEditorFactory.createSelectionEditor(element);
                if (sel) {
                    sel.deselect();
                    sel.insert(request.data);
                    response.wasSuccessful = true;

                } else {
                    response.wasSuccessful = false;
                }

            } else {
                response.wasSuccessful = false;
            }
            break;
    }
    sendResponse(response);
});

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
    return (doc.activeElement && doc.activeElement.contentDocument)
        ? getActiveElement(doc.activeElement.contentDocument)
        : doc.activeElement;
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
    }

    if (ee.editor.isActive() != state.enabled) {
        if (state.enabled)
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
    if(!state.enabled) {
        state.enabled = true;
        refreshEditableElements(document);
        
        refreshInterval = setInterval(function() {
            refreshEditableElements(document);
        }, 400);
    }
}

function disable () {
    if (state.enabled) {
        state.enabled = false;
        clearInterval(refreshInterval);
        Object.keys(editableElements).forEach(key => editableElements[key].editor.deactivate());
    }
}
