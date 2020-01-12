"use strict";

import m from "../mappings/koreanKeyboardMap";

const layout = [
    ["Backquote", "Digit1", "Digit2", "Digit3", "Digit4", "Digit5", "Digit6", "Digit7", "Digit8", "Digit9", "Digit0", "Minus", "Equals", "Backspace"],
    ["Tab", "KeyQ", "KeyW", "KeyE", "KeyR", "KeyT", "KeyY", "KeyU", "KeyI", "KeyO", "KeyP", "BracketLeft", "BracketRight", "Backslash"],
    ["CapsLock", "KeyA", "KeyS", "KeyD", "KeyF", "KeyG", "KeyH", "KeyJ", "KeyK", "KeyL", "Semicolon", "Quote", "Enter"],
    ["Shift", "KeyZ", "KeyX", "KeyC", "KeyV", "KeyB", "KeyN", "KeyM", "Comma", "Period", "Slash", "ShiftRight"]
];

setupKeyboard();

function setupKeyboard() {
    const keyboard = document.getElementById("keyboard");
    layout.forEach(row => {
        const rowElement = document.createElement("div");
        rowElement.className = "row";

        row.forEach(keyName => {
            const keyElement = document.createElement("kbd");
            const key = m[keyName];

            keyElement.className = keyName;

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
