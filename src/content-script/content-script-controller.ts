import { OnScreenKeyboardController } from "./on-screen-keyboard/on-screen-keyboard-controller";
import { KeyCode } from "../keyboard/korean-keyboard-map";
import { TextInputManager } from "./text-input-manager";
import { debugLog } from "../debug-log";
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
import { api } from "../platform/browser-api";

export class ContentScriptController {
    private isHanYongEnabled = false;
    private isHanYongKeyboardKeyEnabled = false;
    private textEntryMode = KoreanKeyboardMode.English;
    private textInputManager = new TextInputManager();
    private keyboardController?: OnScreenKeyboardController;

    public initialize(isTopWindow: boolean) {
        this.keyboardController = isTopWindow
            ? new OnScreenKeyboardController((key, keyCode) => {
                  const handled = this.textInputManager.enterCharacter(key, keyCode);
                  if (!handled) {
                      api.runtime.sendMessage<ContentScriptRequestMessage>({
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
        api.runtime.sendMessage<ContentScriptRequestMessage>({
            type: "contentScriptRequest",
            action: ContentScriptRequestAction.RefreshState,
        });
    }

    private setupMessageListener() {
        api.runtime.onMessage.addListener((message) => {
            debugLog("content.js: received message", message);

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
        this.isHanYongEnabled = message.data.isHanYongEnabled;
        this.isHanYongKeyboardKeyEnabled = message.data.isHanYongKeyboardKeyEnabled;

        // Tell the on-screen keyboard about the master state first, so it can
        // reset its independent (master-off) mode when the regime changes.
        this.keyboardController?.setHanYongEnabled(message.data.isHanYongEnabled);

        // The physical keyboard follows the shared mode only while Hangul typing
        // is enabled; otherwise it is locked to Latin.
        const physicalMode = message.data.isHanYongEnabled
            ? message.data.koreanKeyboardMode
            : KoreanKeyboardMode.English;

        if (physicalMode !== this.textEntryMode) {
            this.setTextEntryMode(physicalMode);
        }

        // Mirror the shared mode onto the on-screen keyboard only while Hangul
        // typing is enabled. While it is disabled the OSK owns its own mode (an
        // ephemeral, tab-local toggle), so we must not overwrite it here.
        if (message.data.isHanYongEnabled) {
            this.keyboardController?.setMode(message.data.koreanKeyboardMode);
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
                if (
                    this.isHanYongEnabled &&
                    this.isHanYongKeyboardKeyEnabled &&
                    e.code === KeyCode.AltRight &&
                    !e.repeat
                ) {
                    api.runtime.sendMessage<ContentScriptRequestMessage>({
                        type: "contentScriptRequest",
                        action: ContentScriptRequestAction.ToggleHanYongMode,
                    });
                    e.preventDefault();
                }
            },
            true
        );

        // Firefox (Windows/Linux) toggles its menu bar when Alt is pressed and
        // released without an intervening key — triggered on keyup. The keydown
        // preventDefault above doesn't stop it, so also swallow the AltRight
        // keyup. (No-op on Chrome, which has no such behaviour.)
        document.addEventListener(
            "keyup",
            (e) => {
                if (this.isHanYongEnabled && this.isHanYongKeyboardKeyEnabled && e.code === KeyCode.AltRight) {
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

                api.runtime.sendMessage<ContentScriptBroadcastMessage>({
                    type: "broadcast",
                    action: ContentScriptBroadcastAction.UpdateCompositionFeatures,
                    data: compositionFeatures,
                });
            },
            true
        );
    }

    // Drives only the physical keyboard's composition mode. The on-screen
    // keyboard's mode is handled separately in handleTabStateMessage, because
    // while Hangul typing is disabled the OSK runs an independent local mode
    // that the physical keyboard must not share.
    private setTextEntryMode(mode: KoreanKeyboardMode) {
        if (mode == this.textEntryMode) {
            return;
        }

        this.textEntryMode = mode;

        this.textInputManager.setMode(mode);
    }
}
