import {
    ContentScriptRequestMessage,
    ContentScriptRequestAction,
    SendKeyRequestMessage,
} from "../messaging/content-to-service-messages";
import { StateManager } from "./state-manager";
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
                console.debug("ContentScriptListener received message: ", message);

                if (!sender.tab?.id) {
                    return;
                }

                if (isContentScriptBroadcastMessage(message)) {
                    if (sender.frameId !== undefined) {
                        this.stateManager.setFocusedFrame(sender.tab.id, sender.frameId);
                    }
                    this.forwardMessageToTab(sender.tab.id, message);
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
    }

    private forwardMessageToTab(tabId: number, message: ContentScriptBroadcastMessage) {
        chrome.tabs.sendMessage(tabId, message);
    }
}
