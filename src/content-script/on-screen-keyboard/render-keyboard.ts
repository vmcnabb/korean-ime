import { KeyboardState } from "./keyboard-state";
import { KeyCode, KeyRecord, keyMap } from "./korean-keyboard-map";

const layout: KeyCode[][] = [
    [KeyCode.Backquote, KeyCode.Digit1, KeyCode.Digit2, KeyCode.Digit3, KeyCode.Digit4, KeyCode.Digit5, KeyCode.Digit6, KeyCode.Digit7, KeyCode.Digit8, KeyCode.Digit9, KeyCode.Digit0, KeyCode.Minus, KeyCode.Equals, KeyCode.Backspace],
    [KeyCode.KeyQ, KeyCode.KeyW, KeyCode.KeyE, KeyCode.KeyR, KeyCode.KeyT, KeyCode.KeyY, KeyCode.KeyU, KeyCode.KeyI, KeyCode.KeyO, KeyCode.KeyP, KeyCode.BracketLeft, KeyCode.BracketRight, KeyCode.Backslash],
    [KeyCode.KeyA, KeyCode.KeyS, KeyCode.KeyD, KeyCode.KeyF, KeyCode.KeyG, KeyCode.KeyH, KeyCode.KeyJ, KeyCode.KeyK, KeyCode.KeyL, KeyCode.Semicolon, KeyCode.Quote],
    [KeyCode.ShiftLeft, KeyCode.KeyZ, KeyCode.KeyX, KeyCode.KeyC, KeyCode.KeyV, KeyCode.KeyB, KeyCode.KeyN, KeyCode.KeyM, KeyCode.Comma, KeyCode.Period, KeyCode.Slash],
    [KeyCode.Space, KeyCode.AltRight, KeyCode.ControlRight]
];

function handleMouseDown(
    e: MouseEvent,
    key: KeyRecord,
    keyCode: KeyCode,
    state: KeyboardState,
) {
    e.preventDefault();

    if (key.jamo && state.isHanMode) {
        const jamoToAdd = state.shift && key.jamo.shift ?
            key.jamo.shift :
            key.jamo.normal;

        state.keyboard.sendCharacter!(jamoToAdd);

    } else if (key.normal && (!state.isHanMode || !key.jamo)) {
        const keyToSend = state.shift && key.shift ?
            key.shift :
            key.normal;

        state.keyboard.sendCharacter!(keyToSend);

    } else if (key.label === "Shift") {
        state.shift = !state.shift;
        state.keyboard.element!.classList.toggle("shift", state.shift);

    } else if (keyCode === KeyCode.AltRight) {
        chrome.runtime.sendMessage({
            action: "toggle"
        });

    } else if (keyCode === KeyCode.Space) {
        state.keyboard.sendCharacter!(" ");

    } else if (keyCode === KeyCode.Backspace) {
        state.keyboard.sendCharacter!("\b");
    }

    return false;
}

function createLabelElement(className: string, text: string): HTMLElement {
    const label = document.createElement("div");
    label.className = className;
    label.innerText = text;
    return label;
}

function renderNormalKeyLabels(keyElement: HTMLElement, key: KeyRecord): void {
    if (!key.normal) return;

    const yongClass = key.jamo ? " yong" : "";
    const baseLabel = createLabelElement(`base${yongClass}`, key.normal);
    keyElement.appendChild(baseLabel);

    if (key.shift) {
        const shiftLabel = createLabelElement(`shift${yongClass}`, key.shift);
        keyElement.appendChild(shiftLabel);
    }
}

function renderJamoKeyLabels(keyElement: HTMLElement, key: KeyRecord): void {
    if (!key.jamo) return;

    if (key.jamo.shift) {
        const shiftJamo = createLabelElement("shift jamo", key.jamo.shift);
        keyElement.appendChild(shiftJamo);
    }

    const baseJamoClassName = "shift" in key.jamo && key.jamo.shift ? "base jamo" : "full jamo";
    const baseJamo = createLabelElement(baseJamoClassName, key.jamo.normal);
    keyElement.appendChild(baseJamo);
}

function renderSpecialKeyLabels(keyElement: HTMLElement, key: KeyRecord, keyCode: KeyCode): void {
    if (keyCode === KeyCode.ShiftLeft) {
        const label = createLabelElement("full", "⇧");
        keyElement.appendChild(label);

    } else if (keyCode === KeyCode.AltRight) {
        const hanLabel = createLabelElement("hanMode", "한");
        const yongLabel = createLabelElement("yongMode", "영");
        keyElement.appendChild(hanLabel);
        keyElement.appendChild(yongLabel);

    } else if (key.label) {
        const label = createLabelElement("full", key.label);
        keyElement.appendChild(label);

        if (key.koreanLabel) {
            const koreanLabel = createLabelElement("full jamo", key.koreanLabel);
            keyElement.appendChild(koreanLabel);
            label.classList.add("yong");
        }
    }
}

function renderKey(
    rowElement: HTMLDivElement,
    keyCode: KeyCode,
    state: KeyboardState,
) {
    const keyElement = document.createElement("kbd");
    const key = keyMap[keyCode];

    keyElement.className = keyCode;
    keyElement.addEventListener("mousedown", e => handleMouseDown(e, key, keyCode, state));

    renderNormalKeyLabels(keyElement, key);
    renderJamoKeyLabels(keyElement, key);
    renderSpecialKeyLabels(keyElement, key, keyCode);

    if (key.tooltipResourceKey) {
        keyElement.title = chrome.i18n.getMessage(key.tooltipResourceKey);
    }

    rowElement.appendChild(keyElement);
}

/**
 * Creates keys and handlers then adds them to the keyboard
 * @param keyboard the keyboard element to be rendered
 */
export function renderKeyboard(state: KeyboardState): void {
    layout.forEach(row => {
        const rowElement = document.createElement("div");
        rowElement.className = "row";

        row.forEach(keyCode => renderKey(rowElement, keyCode, state));

        state.keyboard.element!.appendChild(rowElement);
    });
}
