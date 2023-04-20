import { IsKimeMessage } from "../messaging";
import { OnScreenKeyboardController } from "./on-screen-keyboard/on-screen-keyboard-controller";
import { KeyCode } from "./on-screen-keyboard/korean-keyboard-map";
import { TextInputManager } from "./text-input-manager";
import { TextEntryMode } from "./text-entry-mode.t";

let textEntryMode = TextEntryMode.English;
const isTopWindow = window === top;

const textInputManager = new TextInputManager();
const keyboardController = isTopWindow
    ? new OnScreenKeyboardController(onEnterChar)
    : undefined;

setupMessageListener();
setupDocumentListeners();

function onEnterChar(char: string, keyCode: KeyCode) {
    textInputManager.enterCharacter(char, keyCode);
}

function setupMessageListener() {
    const actions = {
        disable: () => setTextEntryMode(TextEntryMode.English),
        enable: () => setTextEntryMode(TextEntryMode.Hangul),
    };

    chrome.runtime.onMessage.addListener(message => {
        console.debug("content.js: received message", message);

        if (!IsKimeMessage(message)) {
            return;
        }

        if (actionHasKeyFor(message.action, actions)) {
            const action = actions[message.action];
            action();

        } else if (keyboardController && actionHasKeyFor(message.action, keyboardController.messageHandlers)) {
            const action = keyboardController.messageHandlers[message.action];
            action();

        } else if (actionHasKeyFor(message.action, textInputManager.messageHandlers)) {
            const action = textInputManager.messageHandlers[message.action];
            action(message);
        }
    });
}

function actionHasKeyFor<TObject extends object>(
    action: string,
    object: TObject
  ): action is keyof TObject & string {
    return action in object;
}

function setupDocumentListeners() {
    // send message to background script to toggle between hangul and english mode
    document.addEventListener(
        "keydown",
        e => {
            if (e.code === KeyCode.AltRight && !e.repeat) {
                chrome.runtime.sendMessage(
                    { action: "toggle" }
                );
                e.preventDefault();
            }
        },
        true
    );
}

function setTextEntryMode(mode: TextEntryMode) {
    if (mode == textEntryMode) {
        return;
    }

    textEntryMode = mode;

    textInputManager.setMode(mode);
    keyboardController?.setMode(mode);
}
