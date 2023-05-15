import {
    ContentScriptRequestMessage,
    ContentScriptRequestAction,
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
    private static _instance: ContentScriptListener;
    private isListening = false;

    private constructor() {
        // private constructor to prevent instantiation
    }

    public static get instance(): ContentScriptListener {
        if (!ContentScriptListener._instance) {
            ContentScriptListener._instance = new ContentScriptListener();
        }
        return ContentScriptListener._instance;
    }

    public listen() {
        if (this.isListening) {
            throw new Error("ContentScriptListener is already listening");
        }

        this.isListening = true;

        // listen for ContentScriptRequest messages and handle them
        chrome.runtime.onMessage.addListener(
            (
                message:
                    | ContentScriptRequestMessage
                    | ContentScriptBroadcastMessage,
                sender
            ) => {
                console.debug(
                    "ContentScriptListener received message: ",
                    message
                );

                if (!sender.tab?.id) {
                    return;
                }

                if (isContentScriptBroadcastMessage(message)) {
                    this.forwardMessageToTab(sender.tab.id, message);
                    return;
                }

                switch (message.action) {
                    case ContentScriptRequestAction.ToggleHanYongMode:
                        StateManager.instance.toggleHanYongMode(sender.tab.id);
                        break;

                    case ContentScriptRequestAction.RefreshState:
                        StateManager.instance.sendStateToTab(sender.tab.id);
                        break;
                }
            }
        );

        // listen for active tab changes and send the state to the new tab
        chrome.tabs.onActivated.addListener((activeInfo) => {
            StateManager.instance.sendStateToTab(activeInfo.tabId);
            StateManager.instance.updatePresentation(activeInfo.tabId);
        });
    }

    private forwardMessageToTab(
        tabId: number,
        message: ContentScriptBroadcastMessage
    ) {
        chrome.tabs.sendMessage(tabId, message);
    }
}
