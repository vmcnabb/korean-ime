import { KeyboardState } from "./keyboard-state";
import { KeyCode } from "./korean-keyboard-map";
import { renderKeyboard } from "./render-keyboard";

const state: KeyboardState = {
    shift: false,
    mouse: {
        down: false,
        startX: 0,
        startY: 0,
    },
    keyboard: {
        x: 0,
        y: 0,
    },
    isInitialized: false,
    isHanMode: false,
};

export function InitializeKeyboard(
    keyboard: HTMLDivElement,
    keyPressCb: (key: string) => void,
    moveKeyboardCb: (dx: number, dy: number) => void,
): void {
    if (state.isInitialized) {
        throw new Error("Keyboard is already initialized");
    }

    state.keyboard.element = keyboard;
    state.keyboard.move = moveKeyboardCb;
    state.keyboard.sendCharacter = keyPressCb;

    renderKeyboard(state);

    chrome.runtime.onMessage.addListener((message, _sender, _sendResponse) => {
        if (message.action === "enable") {
            keyboard.classList.add("hanMode");
            keyboard.classList.remove("yongMode");
            state.isHanMode = true;
        }
        if (message.action === "disable") {
            keyboard.classList.remove("hanMode");
            keyboard.classList.add("yongMode");
            state.isHanMode = false;
        }
    });

    keyboard.addEventListener("mousedown", function (e) {
        e.preventDefault();

        if (e.button !== 0 || !(e.target instanceof HTMLElement)) {
            return false;
        }

        if (e.target === keyboard || e.target.classList.contains("row")) {
            state.mouse.down = true;
            state.mouse.startX = e.screenX;
            state.mouse.startY = e.screenY;

            state.keyboard.x = keyboard.clientLeft;
            state.keyboard.y = keyboard.clientTop;
        }

        return false;
    });

    document.addEventListener("mouseup", function dragMouseUpListener (e) {
        if (e.button === 0) {
            state.mouse.down = false;
        }
    });

    document.addEventListener("mousemove", function dragMouseMoveListener (e) {
        if ((e.buttons & 1) === 0) {
            state.mouse.down = false;
        }

        if (state.mouse.down) {
            const dx = e.screenX - state.mouse.startX;
            const dy = e.screenY - state.mouse.startY;

            state.mouse.startX = e.screenX;
            state.mouse.startY = e.screenY;

            moveKeyboardCb(dx, dy);
        }

        return false;
    });

    // listen for keydown and make the key on the keyboard active
    document.addEventListener("keydown", function (e) {
        const keyCode = e.code as KeyCode;

        const keyElement = keyboard.querySelector(`.${keyCode}`) as HTMLDivElement;

        if (keyElement) {
            keyElement.classList.add("active");
        }

        updateShiftState(e);
    });

    // listen for keyup and make the key on the keyboard inactive
    document.addEventListener("keyup", function (e) {
        const keyCode = e.code as KeyCode;

        const keyElement = keyboard.querySelector(`.${keyCode}`) as HTMLDivElement;

        if (keyElement) {
            keyElement.classList.remove("active");
        }

        updateShiftState(e);
    });

    // listen for blur event and remove all active keys
    window.addEventListener("blur", function () {
        const activeKeys = keyboard.querySelectorAll(".active");
        activeKeys.forEach(key => key.classList.remove("active"));
    });

    // update shift state based on the shift key in the keyboard event.
    function updateShiftState(e: KeyboardEvent) {
        if (e.shiftKey) {
            state.shift = true;
            keyboard.classList.add("shift");

        } else {
            state.shift = false;
            keyboard.classList.remove("shift");
        }
    }
}
