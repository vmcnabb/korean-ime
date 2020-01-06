"use strict";

import m from "../mappings/koreanKeyboardMap";

const layout = [
    [m.KeyQ, m.KeyW, m.KeyE, m.KeyR, m.KeyT, m.KeyY, m.KeyU, m.KeyI, m.KeyO, m.KeyP, m.BracketLeft, m.BracketRight],
    [m.KeyA, m.KeyS, m.KeyD, m.KeyF, m.KeyG, m.KeyH, m.KeyJ, m.KeyK, m.KeyL],
    [m.KeyZ, m.KeyX, m.KeyC, m.KeyV, m.KeyB, m.KeyN, m.KeyM]
];

setupKeyboard();

function setupKeyboard() {
    const keyboard = document.getElementById("keyboard");
    layout.forEach(row => {
        const rowElement = document.createElement("div");
        rowElement.className = "row";

        row.forEach(key => {
            const keyElement = document.createElement("kbd");
            keyElement.innerHTML = key;
            rowElement.appendChild(keyElement);
        });

        keyboard.appendChild(rowElement);
    });
}
