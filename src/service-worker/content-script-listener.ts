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
        chrome.runtime.onMessage.addListener(
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

        // listen for active tab changes and send the state to the new tab
        chrome.tabs.onActivated.addListener(async (activeInfo) => {
            await this.stateManager.sendStateToTab(activeInfo.tabId);
            await this.stateManager.updatePresentation(activeInfo.tabId);
        });

        // discard a tab's state when it closes so it doesn't accumulate
        chrome.tabs.onRemoved.addListener((tabId) => {
            this.stateManager.clearTabState(tabId);
        });
    }
}
