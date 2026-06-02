import {
    ContentScriptRequestMessage,
    ContentScriptRequestAction,
    SendKeyRequestMessage,
} from "../messaging/content-to-service-messages";
import { StateManager } from "./state-manager";
import { sendMessageToTab } from "./send-message-to-tab";
import { debugLog } from "../debug-log";
import {
    ContentScriptBroadcastMessage,
    isContentScriptBroadcastMessage,
} from "../messaging/content-to-content-messages";
import { api } from "../platform/browser-api";

/**
 * This class is responsible for listening to messages from the content script.
 */
export class ContentScriptListener {
    private isListening = false;

    public constructor(private stateManager: StateManager) {}

    public listen() {
        if (this.isListening) {
            throw new Error("ContentScriptListener is already listening");
        }

        this.isListening = true;

        // listen for ContentScriptRequest messages and handle them
        api.runtime.onMessage.addListener(
            (message: ContentScriptRequestMessage | ContentScriptBroadcastMessage, sender) => {
                debugLog("ContentScriptListener received message: ", message);

                if (!sender.tab?.id) {
                    return;
                }

                if (isContentScriptBroadcastMessage(message)) {
                    if (sender.frameId !== undefined) {
                        this.stateManager.setFocusedFrame(sender.tab.id, sender.frameId);
                    }
                    sendMessageToTab(sender.tab.id, message);
                    return;
                }

                switch (message.action) {
                    case ContentScriptRequestAction.ToggleHanYongMode:
                        this.stateManager.toggleHanYongMode(sender.tab.id);
                        break;

                    case ContentScriptRequestAction.RefreshState:
                        this.stateManager.sendStateToTab(sender.tab.id);
                        break;

                    case ContentScriptRequestAction.SendKey:
                        this.stateManager.routeSendKey(sender.tab.id, (message as SendKeyRequestMessage).data);
                        break;
                }
            }
        );

        // listen for active tab changes: record the newly active tab as the
        // live state (so later-opened tabs inherit it) and refresh its
        // presentation. The listener stays synchronous (the event ignores a
        // returned promise), so detach and log rather than leaking an unhandled
        // rejection into the service worker.
        api.tabs.onActivated.addListener((activeInfo) => {
            void (async () => {
                await this.stateManager.markTabActive(activeInfo.tabId);
                await this.stateManager.sendStateToTab(activeInfo.tabId);
            })().catch((error) => debugLog("onActivated handling failed:", error));
        });

        // discard a tab's state when it closes so it doesn't accumulate
        api.tabs.onRemoved.addListener((tabId) => {
            this.stateManager.clearTabState(tabId).catch((error) => debugLog("clearTabState failed:", error));
        });
    }
}
