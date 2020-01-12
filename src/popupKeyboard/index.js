"use strict";

import m from "../mappings/koreanKeyboardMap";

const layout = [
    ["KeyQ", "KeyW", "KeyE", "KeyR", "KeyT", "KeyY", "KeyU", "KeyI", "KeyO", "KeyP"],
    ["KeyA", "KeyS", "KeyD", "KeyF", "KeyG", "KeyH", "KeyJ", "KeyK", "KeyL"],
    ["ShiftLeft", "KeyZ", "KeyX", "KeyC", "KeyV", "KeyB", "KeyN", "KeyM"],
];

const state = {
    shift: false,
    tabId: undefined,
};

setupKeyboard();

chrome.tabs.getCurrent(tab => {
    state.tabId = tab.id;
});

function setupKeyboard() {
    const keyboard = document.getElementById("keyboard");
    layout.forEach(row => {
        const rowElement = document.createElement("div");
        rowElement.className = "row";

        row.forEach(keyName => {
            const keyElement = document.createElement("kbd");
            const key = m[keyName];

            keyElement.className = keyName;

            keyElement.addEventListener("mousedown", e => {
                e.preventDefault();

                if (key.jamo) {
                    const jamoToAdd = state.shift && key.jamo.shift ?
                        key.jamo.shift :key.jamo.normal;
                    chrome.tabs.sendMessage(state.tabId, {
                        action: "keyboard",
                        key: jamoToAdd
                    });
                }

                return false;
            });

            const shiftLabel = document.createElement("div");
            shiftLabel.className = "shift";
            shiftLabel.innerText = key.shift || key.label;
            keyElement.appendChild(shiftLabel);

            if (!key.normal) {

            } else if (!key.jamo) {
                const baseLabel = document.createElement("div");
                baseLabel.className = "base";
                baseLabel.innerText = key.normal;
                keyElement.appendChild(baseLabel);

            } else {
                const baseJamo = document.createElement("div");
                baseJamo.className = "base jamo";
                baseJamo.innerText = key.jamo.normal;
                keyElement.appendChild(baseJamo);

                if (key.jamo.shift) {
                    const shiftJamo = document.createElement("div");
                    shiftJamo.className = "shift jamo";
                    shiftJamo.innerText = key.jamo.shift;
                    keyElement.appendChild(shiftJamo);
                }
            }

            rowElement.appendChild(keyElement);
        });

        keyboard.appendChild(rowElement);
    });
}
