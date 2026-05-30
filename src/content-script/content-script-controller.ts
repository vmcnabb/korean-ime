import { OnScreenKeyboardController } from "./on-screen-keyboard/on-screen-keyboard-controller";
import { KeyCode } from "./on-screen-keyboard/korean-keyboard-map";
import { TextInputManager } from "./text-input-manager";
import { KoreanKeyboardMode } from "../extension-state/korean-keyboard-mode";
import { ContentScriptRequestAction, ContentScriptRequestMessage } from "../messaging/content-to-service-messages";
import {
    ContentScriptBroadcastAction,
    ContentScriptBroadcastMessage,
    isContentScriptBroadcastMessage,
} from "../messaging/content-to-content-messages";
import {
    ServiceScriptMessageAction,
    TabStateMessage,
    isServiceScriptMessage,
} from "../messaging/service-to-content-messages";

export class ContentScriptController {
    private textEntryMode = KoreanKeyboardMode.English;
    private textInputManager = new TextInputManager();
    private keyboardController?: OnScreenKeyboardController;

    public initialize(isTopWindow: boolean) {
        this.keyboardController = isTopWindow
            ? new OnScreenKeyboardController((key, keyCode) => {
                  const handled = this.textInputManager.enterCharacter(key, keyCode);
                  if (!handled) {
                      chrome.runtime.sendMessage<ContentScriptRequestMessage>({
                          type: "contentScriptRequest",
                          action: ContentScriptRequestAction.SendKey,
                          data: { key, keyCode },
                      });
                  }
              })
            : undefined;

        this.setupMessageListener();
        this.setupDocumentListeners();
        this.requestState();
    }

    private requestState() {
        chrome.runtime.sendMessage<ContentScriptRequestMessage>({
            type: "contentScriptRequest",
            action: ContentScriptRequestAction.RefreshState,
        });
    }

    private setupMessageListener() {
        chrome.runtime.onMessage.addListener((message) => {
            console.debug("content.js: received message", message);

            if (isServiceScriptMessage(message)) {
                switch (message.action) {
                    case ServiceScriptMessageAction.UpdateState:
                        this.handleTabStateMessage(message);
                        break;
                }
            }

            this.textInputManager.handleMessage(message);

            if (isContentScriptBroadcastMessage(message)) {
                switch (message.action) {
                    case ContentScriptBroadcastAction.UpdateCompositionFeatures:
                        this.keyboardController?.setCompositionFeatures(message.data);
                        break;
                }
            }
        });
    }

    private handleTabStateMessage(message: TabStateMessage) {
        if (message.data.koreanKeyboardMode !== this.textEntryMode) {
            this.setTextEntryMode(message.data.koreanKeyboardMode);
        }

        if (message.data.isOnScreenKeyboardEnabled) {
            this.keyboardController?.showKeyboard();
        } else {
            this.keyboardController?.hideKeyboard();
        }
    }

    private setupDocumentListeners() {
        document.addEventListener(
            "keydown",
            (e) => {
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
            (e) => {
                const element = e.target as HTMLElement;
                const compositionFeatures = this.textInputManager.setActiveElement(element);

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

    private setTextEntryMode(mode: KoreanKeyboardMode) {
        if (mode == this.textEntryMode) {
            return;
        }

        this.textEntryMode = mode;

        this.textInputManager.setMode(mode);
        this.keyboardController?.setMode(mode);
    }
}
