import { ContentScriptMessage, ContentScriptRequestAction } from "../messaging";
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
            }
        });
    }

    private sendKey(tabId: number, data: {key: string, keyCode: KeyCode}) {
        chrome.tabs.sendMessage<TextInputMessage>(tabId, {
            type: "textInputMessage",
            action: TextInputMessageActions.TypeKey,
            data
        });
    }
}
