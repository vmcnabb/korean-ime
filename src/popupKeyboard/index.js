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
    mouse: {
        down: false,
        startX: 0,
        startY: 0
    }
};

setupKeyboard();

chrome.tabs.getCurrent(tab => {
    state.tabId = tab.id;
});

document.addEventListener("mousedown", e => {
    
    const ms = state.mouse;

    if (e.button === 0) {
        ms.down = true;
        ms.startX = e.screenX;
        ms.startY = e.screenY;
    }
});

document.addEventListener("mouseup", e => {
    const ms = state.mouse;

    if (e.button === 0) {
        ms.down = false;
    }
});

document.addEventListener("mousemove", e => {
    const ms = state.mouse;

    if ((e.buttons & 1) === 0) {
        ms.down = false;
    }

    if (ms.down) {
        const dx = e.screenX - ms.startX;
        const dy = e.screenY - ms.startY;

        ms.startX = e.screenX;
        ms.startY = e.screenY;

        chrome.tabs.sendMessage(state.tabId, { action: "moveKeyboard", dx, dy });
    }
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
                e.cancelBubble = true;

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
