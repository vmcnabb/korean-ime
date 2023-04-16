"use strict";

import keyboardMap from "./koreanKeyboardMap";

const layout = [
    ["KeyQ", "KeyW", "KeyE", "KeyR", "KeyT", "KeyY", "KeyU", "KeyI", "KeyO", "KeyP"],
    ["KeyA", "KeyS", "KeyD", "KeyF", "KeyG", "KeyH", "KeyJ", "KeyK", "KeyL"],
    ["ShiftLeft", "KeyZ", "KeyX", "KeyC", "KeyV", "KeyB", "KeyN", "KeyM", "Comma", "Period", "Slash"],
    ["Space", "AltRight"]
];

type State = {
    shift: boolean;
    tabId: number | undefined;
    mouse: {
        down: boolean;
        startX: number;
        startY: number;
    };
};


const state: State = {
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
    state.tabId = tab?.id;
});

chrome.runtime.onMessage.addListener((message, _sender, _sendResponse) => {
    if (message.action === "enable") {
        document.body.classList.add("hanMode");
        document.body.classList.remove("yongMode");
    }
    if (message.action === "disable") {
        document.body.classList.remove("hanMode");
        document.body.classList.add("yongMode");
    }
});

document.addEventListener("mousedown", e => {
    if (!(e.target instanceof HTMLElement)) {
        return false;
    }

    if (e.target.tagName === "KBD") {
        return false;
    }

    const ms = state.mouse;

    if (e.button === 0) {
        ms.down = true;
        ms.startX = e.screenX;
        ms.startY = e.screenY;
    }

    return false;
});

document.addEventListener("focusin", e => {
    console.debug("focusin", e);
    e.preventDefault();
});

document.addEventListener("mouseup", e => {
    const ms = state.mouse;

    if (e.button === 0) {
        ms.down = false;
    }
});

document.addEventListener("mousemove", e => {
    if (!state.tabId) {
        return false;
    }

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

    return false;
});


function setupKeyboard() {
    const keyboard = document.getElementById("keyboard") as HTMLDivElement;
    layout.forEach(row => {
        const rowElement = document.createElement("div");
        rowElement.className = "row";

        row.forEach(keyName => {
            const keyElement = document.createElement("kbd");
            const key = keyboardMap[keyName as keyof typeof keyboardMap];

            keyElement.className = keyName;

            keyElement.addEventListener("mousedown", e => {
                e.preventDefault();

                if ("jamo" in key && key.jamo) {
                    const jamoToAdd = state.shift && "shift" in key.jamo && key.jamo.shift ?
                        key.jamo.shift :
                        key.jamo.normal;

                    if (!state.tabId) {
                        return;
                    }

                    chrome.tabs.sendMessage(state.tabId, {
                        action: "keyboard",
                        key: jamoToAdd
                    });

                } else if ("label" in key && key.label === "Shift") {
                    state.shift = !state.shift;
                    document.body.classList.toggle("shift", state.shift);

                } else if (keyName === "AltRight") {
                    chrome.runtime.sendMessage({
                        action: "toggle"
                    });
                }

                return false;
            });

            if ("jamo" in key && key.jamo) {
                if ("shift" in key.jamo && key.jamo.shift) {
                    const shiftJamo = document.createElement("div");
                    shiftJamo.className = "shift jamo";
                    shiftJamo.innerText = key.jamo.shift;
                    keyElement.appendChild(shiftJamo);
                }

                const baseJamo = document.createElement("div");
                baseJamo.className = "shift" in key.jamo && key.jamo.shift
                    ? "base jamo"
                    : "full jamo";

                baseJamo.innerText = key.jamo.normal;
                keyElement.appendChild(baseJamo);

            } else if (keyName === "ShiftLeft") {
                const baseLabel = document.createElement("div");
                baseLabel.className = "huge";
                baseLabel.innerText = "⇧";
                keyElement.appendChild(baseLabel);

            } else if (keyName === "AltRight") {
                const hanLabel = document.createElement("div");
                const yongLabel = document.createElement("div");

                hanLabel.className = "hanMode";
                yongLabel.className = "yongMode";

                hanLabel.innerText = "한";
                yongLabel.innerText = "영";

                keyElement.appendChild(hanLabel);
                keyElement.appendChild(yongLabel);

            } else if ("label" in key && key.label) {
                const baseLabel = document.createElement("div");
                baseLabel.className = "full";
                baseLabel.innerText = key.label;
                keyElement.appendChild(baseLabel);
            }

            rowElement.appendChild(keyElement);
        });

        keyboard.appendChild(rowElement);
    });
}
