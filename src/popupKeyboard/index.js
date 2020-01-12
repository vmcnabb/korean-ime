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

                } else if (key.label === "Shift") {
                    state.shift = !state.shift;
                    document.body.classList.toggle("shift", state.shift);
                }

                return false;
            });

            if (keyName === "ShiftLeft") {
                const baseLabel = document.createElement("div");
                baseLabel.className = "full";
                baseLabel.innerText = "⇧";
                keyElement.appendChild(baseLabel);
            }

            if (key.jamo) {
                if (key.jamo.shift) {
                    const shiftJamo = document.createElement("div");
                    shiftJamo.className = "shift jamo";
                    shiftJamo.innerText = key.jamo.shift;
                    keyElement.appendChild(shiftJamo);
                }

                const baseJamo = document.createElement("div");
                baseJamo.className = "base jamo";
                baseJamo.innerText = key.jamo.normal;
                keyElement.appendChild(baseJamo);
            }

            rowElement.appendChild(keyElement);
        });

        keyboard.appendChild(rowElement);
    });
}
