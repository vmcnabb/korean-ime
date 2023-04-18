import { IsKimeMessage, KimeMessage } from "../messaging";
import { CompositionAdapterFactory } from "../composition/composition-adapter-factory";
import { OnScreenKeyboardController } from "./on-screen-keyboard/on-screen-keyboard-controller";
import { HangulImeController } from "../composition/hangul-ime-controller";

type KeyboardPlacement = {
    originX: "left" | "right";
    originY: "top" | "bottom";
    x: number;
    y: number;
};

export interface ContentScriptState {
    isHangulMode: boolean;
    keyboard: {
        isEnabled: boolean;
        element?: HTMLDivElement;
        placement: KeyboardPlacement;
    };
    isTopElement: boolean;
    getActiveElement: (doc: Document) => HTMLElement | null;
    imeControllers: Map<HTMLElement, HangulImeController>;
}

const imeControllers = new Map<HTMLElement, HangulImeController>();
const state: ContentScriptState = {
    isHangulMode: false,
    keyboard: {
        isEnabled: false,
        element: undefined,
        placement: {
            originX: "right",
            originY: "bottom",
            x: 0,
            y: 0,
        },
    },
    isTopElement: window === top,
    getActiveElement: getActiveElement,
    imeControllers: imeControllers,
};

const keyboardController = new OnScreenKeyboardController(state);
setupListener();

function setupListener() {
    const actions = {
        disable: disable,
        enable: enable,
        insertAfter: (message: KimeMessage) => {
            const element = getActiveElement(document);

            if (!element) {
                return;
            }

            const compositionAdapter = CompositionAdapterFactory.createCompositionAdapter(element);

            if (!compositionAdapter) {
                return;
            }

            compositionAdapter.deselect();
            compositionAdapter.updateComposition(message.data);
            compositionAdapter.deselect();
        },
    };

    chrome.runtime.onMessage.addListener(message => {
        console.debug("content.js: received message", message);

        if (!IsKimeMessage(message)) {
            return;
        }

        if (actionHasKeyFor<typeof actions>(message.action, actions)) {
            const action = actions[message.action];
            action(message);

        } else if (actionHasKeyFor<typeof keyboardController.MessageHandlers>(message.action, keyboardController.MessageHandlers)) {
            const action = keyboardController.MessageHandlers[message.action];
            action();
        }
    });
}

function actionHasKeyFor<TObject extends object>(
    action: string,
    object: TObject
  ): action is keyof TObject & string {
    return action in object;
  }

document.addEventListener(
    "keydown",
    e => {
        if (e.code === "AltRight" && !e.repeat) {
            chrome.runtime.sendMessage(
                { action: "toggle" }
            );
            e.preventDefault();
        }
    },
    true
);

function getActiveElement(doc: Document): HTMLElement | null {
    const isActiveElementInChildDocument = doc.activeElement
        && isObjectOrIframe(doc.activeElement)
        && doc.activeElement.contentDocument;

    const element = isActiveElementInChildDocument
        ? getActiveElement(doc.activeElement.contentDocument)
        : doc.activeElement;

    return element instanceof HTMLElement ? element : null;
}

function isObjectOrIframe(element: Element): element is HTMLObjectElement | HTMLIFrameElement {
    return element instanceof HTMLObjectElement || element instanceof HTMLIFrameElement;
}

function processElement(element: HTMLElement) {
    let imeController = imeControllers.get(element);

    if (!imeController) {
        imeController = new HangulImeController(element);
        imeControllers.set(element, imeController);
    }

    if (imeController.isActive() != state.isHangulMode) {
        if (state.isHangulMode) {
            imeController.activate();
        } else {
            imeController.deactivate();
        }
    }
}

function refreshTextInputElements(doc: Document) {
    if (!doc) {
        return false;
    }

    const nonTextInputTypes = ["button", "checkbox", "file", "hidden", "image", "radio", "range", "submit"];
    const inputSelector = `input:not(${nonTextInputTypes.map(t => `[type=${t}]`).join(",")})`;
    const textInputElementsSelector = `[contenteditable=true],textarea,${inputSelector}`;

    const elements = doc.querySelectorAll<HTMLElement>(textInputElementsSelector);
    for (const element of elements) {
        processElement(element);
    }

    return true;
}

let refreshInterval: number;

function enable() {
    if (state.isHangulMode) {
        return;
    }

    state.isHangulMode = true;

    // probably not necessary but just in case
    window.clearInterval(refreshInterval);
    refreshTextInputElements(document);

    refreshInterval = window.setInterval(function () {
        refreshTextInputElements(document);
    }, 400);

    keyboardController.updateKeyboard();
}

function disable() {
    if (!state.isHangulMode) {
        return;
    }

    state.isHangulMode = false;
    clearInterval(refreshInterval);
    keyboardController.updateKeyboard();

    for (const [_, controller] of imeControllers) {
        controller.deactivate();
    }
}
