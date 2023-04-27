import { ContentScriptMessage, ContentScriptRequestAction } from "../messaging/content-script-request-messages";
import { StateManager } from "./state-manager";
import { KeyCode } from "../content-script/on-screen-keyboard/korean-keyboard-map";
import { TextInputMessage, TextInputMessageActions } from "../content-script/text-input-manager/message-definitions";

/**
 * This class is responsible for listening to messages from the content script.
 */
export class ContentScriptListener {
    private static _instance: ContentScriptListener;
    private isListening = false;

    private constructor() {}

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
        chrome.runtime.onMessage.addListener((message: ContentScriptMessage, sender) => {
            console.debug("ContentScriptListener received message: ", message);

            if (!sender.tab?.id) {
                return;
            }

            switch (message.action) {
                case ContentScriptRequestAction.ToggleHanYongMode:
                    StateManager.instance.toggleHanYongMode(sender.tab.id);
                    break;

                case ContentScriptRequestAction.SendKey:
                    this.sendKey(sender.tab.id, message.data);
                    break;

                case ContentScriptRequestAction.RefreshState:
                    StateManager.instance.sendStateToTab(sender.tab.id);
                    break;

                case ContentScriptRequestAction.UpdateCompositionFeatures:
                    this.forwardMessageToTab(sender.tab.id, message);
                    break;
            }
        });

        // listen for active tab changes and send the state to the new tab
        chrome.tabs.onActivated.addListener(activeInfo => {
            StateManager.instance.sendStateToTab(activeInfo.tabId);
        });
    }

    private forwardMessageToTab(tabId: number, message: ContentScriptMessage) {
        chrome.tabs.sendMessage(tabId, message);
    }

    private sendKey(tabId: number, data: {key: string, keyCode: KeyCode}) {
        chrome.tabs.sendMessage<TextInputMessage>(tabId, {
            type: "textInputMessage",
            action: TextInputMessageActions.TypeKey,
            data
        });
    }
}
