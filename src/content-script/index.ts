import { OnScreenKeyboardController } from "./on-screen-keyboard/on-screen-keyboard-controller";
import { KeyCode } from "./on-screen-keyboard/korean-keyboard-map";
import { TextInputManager } from "./text-input-manager";
import { KoreanKeyboardMode } from "../extension-state/korean-keyboard-mode";
import { ContentScriptMessage, ContentScriptRequestAction, TabStateMessage, isTabStateMessage } from "../messaging";
import { isTextInputMessage } from "./text-input-manager/message-definitions";

let textEntryMode = KoreanKeyboardMode.English;
const isTopWindow = window === top;

const textInputManager = new TextInputManager();
const keyboardController = isTopWindow
    ? new OnScreenKeyboardController()
    : undefined;

setupMessageListener();
setupHanYongKeyListener();
requestState();

function requestState() {
    chrome.runtime.sendMessage<ContentScriptMessage>({
        type: "contentScriptRequest",
        action: ContentScriptRequestAction.RefreshState,
    });
}

function setupMessageListener() {
    chrome.runtime.onMessage.addListener(message => {
        console.debug("content.js: received message", message);

        if (isTabStateMessage(message)) {
            handleTabStateMessage(message);
        }

        if (isTextInputMessage(message)) {
            textInputManager.handleMessage(message);
        }
    });
}

function handleTabStateMessage(message: TabStateMessage) {
    if (message.data.koreanKeyboardMode !== textEntryMode) {
        setTextEntryMode(message.data.koreanKeyboardMode);
    }

    if (message.data.isOnScreenKeyboardEnabled) {
        keyboardController?.showKeyboard();
    } else {
        keyboardController?.hideKeyboard();
    }
}

function setupHanYongKeyListener() {
    document.addEventListener(
        "keydown",
        e => {
            if (e.code === KeyCode.AltRight && !e.repeat) {
                chrome.runtime.sendMessage<ContentScriptMessage>({
                    type: "contentScriptRequest",
                    action: ContentScriptRequestAction.ToggleHanYongMode,
                });
                e.preventDefault();
            }
        },
        true
    );
}

function setTextEntryMode(mode: KoreanKeyboardMode) {
    if (mode == textEntryMode) {
        return;
    }

    textEntryMode = mode;

    textInputManager.setMode(mode);
    keyboardController?.setMode(mode);
}
