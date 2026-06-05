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
import { routeByAction } from "../messaging/route-message";
import { currentOskSite } from "./osk-site";
import { loadSettings, saveSettings } from "../settings/settings-store";
import { LayoutId } from "../extension-state/osk-layout";

export class ContentScriptController {
    private isHanYongEnabled = false;
    private isHanYongKeyboardKeyEnabled = false;
    private textEntryMode = KoreanKeyboardMode.English;
    private textInputManager = new TextInputManager();
    private keyboardController?: OnScreenKeyboardController;
    // The keyboard's first show is gated on its saved layout arriving, so a
    // restored position never appears at the default corner and then jumps.
    private isOskLayoutApplied = false;
    private shouldShowOsk = false;

    public initialize(isTopWindow: boolean) {
        this.keyboardController = isTopWindow
            ? new OnScreenKeyboardController(
                  (key, keyCode) => {
                      const handled = this.textInputManager.enterCharacter(key, keyCode);
                      if (!handled) {
                          api.runtime.sendMessage<ContentScriptRequestMessage>({
                              type: "contentScriptRequest",
                              action: ContentScriptRequestAction.SendKey,
                              data: { key, keyCode },
                          });
                      }
                  },
                  (layoutId) => void this.saveLayoutSetting(layoutId)
              )
            : undefined;

        this.setupMessageListener();
        this.setupDocumentListeners();
        this.requestState();

        // Only the top window hosts the keyboard, so only it needs the saved
        // position layout (the reply gates the first show — see
        // updateOskVisibility) and the layout-arrangement setting.
        if (isTopWindow) {
            this.requestOnScreenKeyboardLayout();
            void this.applyLayoutSetting();
            this.watchLayoutSetting();
        }
    }

    private requestState() {
        api.runtime.sendMessage<ContentScriptRequestMessage>({
            type: "contentScriptRequest",
            action: ContentScriptRequestAction.RefreshState,
        });
    }

    /** Apply the chosen key arrangement (a synced setting) to the keyboard. */
    private async applyLayoutSetting() {
        const settings = await loadSettings();
        this.keyboardController?.setLayout(settings.onScreenKeyboard.layout);
    }

    /** Persist the layout chosen from the keyboard's drop-down (the synced setting,
     *  shared with the options page; the storage.onChanged watcher re-applies it). */
    private async saveLayoutSetting(layoutId: LayoutId) {
        const settings = await loadSettings();
        settings.onScreenKeyboard.layout = layoutId;
        await saveSettings(settings);
    }

    /** Re-apply the layout when the setting changes (the options page writes it). */
    private watchLayoutSetting() {
        api.storage.onChanged.addListener((changes, area) => {
            if (area === "sync" && "onScreenKeyboard" in changes) {
                this.applyLayoutSetting().catch((error) => debugLog("applyLayoutSetting failed:", error));
            }
        });
    }

    private requestOnScreenKeyboardLayout() {
        api.runtime.sendMessage<ContentScriptRequestMessage>({
            type: "contentScriptRequest",
            action: ContentScriptRequestAction.RequestOnScreenKeyboardLayout,
            data: { site: currentOskSite() },
        });
    }

    private setupMessageListener() {
        api.runtime.onMessage.addListener((message) => {
            debugLog("content.js: received message", message);

            if (isServiceScriptMessage(message)) {
                routeByAction(message, {
                    [ServiceScriptMessageAction.UpdateState]: (m) => this.handleTabStateMessage(m),
                    [ServiceScriptMessageAction.SendKey]: (m) =>
                        this.textInputManager.enterCharacter(m.data.key, m.data.keyCode),
                    [ServiceScriptMessageAction.InsertTextAfterSelection]: (m) =>
                        this.textInputManager.insertTextAfterSelection(m.data),
                    [ServiceScriptMessageAction.OnScreenKeyboardLayout]: (m) => {
                        this.keyboardController?.applyPersistedLayout(m.data);
                        this.isOskLayoutApplied = true;
                        this.updateOskVisibility();
                    },
                });
            } else if (isContentScriptBroadcastMessage(message)) {
                routeByAction(message, {
                    [ContentScriptBroadcastAction.UpdateCompositionFeatures]: (m) =>
                        this.keyboardController?.setCompositionFeatures(m.data),
                });
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

        this.shouldShowOsk = message.data.isOnScreenKeyboardEnabled;
        this.updateOskVisibility();
    }

    // Show the keyboard only once it's both wanted and its saved layout has been
    // applied, so a restored position isn't shown at the default corner first.
    // Hiding needs no layout and happens immediately.
    private updateOskVisibility() {
        if (!this.shouldShowOsk) {
            this.keyboardController?.hideKeyboard();
        } else if (this.isOskLayoutApplied) {
            this.keyboardController?.showKeyboard();
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
