import { OnScreenKeyboardController } from "./on-screen-keyboard/on-screen-keyboard-controller";
import { KeyCode } from "./on-screen-keyboard/korean-keyboard-map";
import { TextInputManager } from "./text-input-manager";
import { KoreanKeyboardMode } from "../extension-state/korean-keyboard-mode";
import { ContentScriptRequestAction, ContentScriptRequestMessage } from "../messaging/content-to-service-messages";
import { ContentScriptBroadcastAction, ContentScriptBroadcastMessage, isContentScriptBroadcastMessage } from "../messaging/content-to-content-messages";
import { ServiceScriptMessage, ServiceScriptMessageAction, isServiceScriptMessage } from "../messaging/service-to-content-messages";

let textEntryMode = KoreanKeyboardMode.English;
const isTopWindow = window === top;

const textInputManager = new TextInputManager();
const keyboardController = isTopWindow
    ? new OnScreenKeyboardController()
    : undefined;

setupMessageListener();
setupDocumentListeners();
requestState();

function requestState() {
    chrome.runtime.sendMessage<ContentScriptRequestMessage>({
        type: "contentScriptRequest",
        action: ContentScriptRequestAction.RefreshState,
    });
}

function setupMessageListener() {
    chrome.runtime.onMessage.addListener(message => {
        console.debug("content.js: received message", message);

        if (isServiceScriptMessage(message)) {
            switch (message.action) {
                case ServiceScriptMessageAction.UpdateState:
                    handleTabStateMessage(message);
                    break;
            }
        }

        textInputManager.handleMessage(message);

        if (isContentScriptBroadcastMessage(message)) {
            switch (message.action) {
                case ContentScriptBroadcastAction.UpdateCompositionFeatures:
                    keyboardController?.setCompositionFeatures(message.data);
                    break;
            }
        }
    });
}

function handleTabStateMessage(message: ServiceScriptMessage.TabStateMessage) {
    if (message.data.koreanKeyboardMode !== textEntryMode) {
        setTextEntryMode(message.data.koreanKeyboardMode);
    }

    if (message.data.isOnScreenKeyboardEnabled) {
        keyboardController?.showKeyboard();
    } else {
        keyboardController?.hideKeyboard();
    }
}

function setupDocumentListeners() {
    document.addEventListener(
        "keydown",
        e => {
            if (e.code === KeyCode.AltRight && !e.repeat) {
                chrome.runtime.sendMessage<ContentScriptRequestMessage>({
                    type: "contentScriptRequest",
                    action: ContentScriptRequestAction.ToggleHanYongMode,
                });
                e.preventDefault();
            }
        },
        true
    );

    // whenever a new element receives focus, notify text input manager
    document.addEventListener(
        "focus",
        e => {
            const element = e.target as HTMLElement;
            const compositionFeatures = textInputManager.setActiveElement(element);

            if (!compositionFeatures) {
                // todo: notify everyone that there is no active element
                return;
            }

            chrome.runtime.sendMessage<ContentScriptBroadcastMessage>({
                type: "broadcast",
                action: ContentScriptBroadcastAction.UpdateCompositionFeatures,
                data: compositionFeatures,
            });
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
