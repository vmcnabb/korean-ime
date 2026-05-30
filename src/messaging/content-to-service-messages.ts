// messages sent from content scripts to the background script

import { KeyCode } from "../content-script/on-screen-keyboard/korean-keyboard-map";
import { hasProperties } from "../types/objects";

export enum ContentScriptRequestAction {
    /** request the TabState from the service script */
    RefreshState = "refreshState",
    /** request the service script to toggle han/yong mode */
    ToggleHanYongMode = "toggleHanYongMode",
    /** request the service script to route a key to the focused frame */
    SendKey = "sendKey",
}

export type SendKeyRequestMessage = {
    type: "contentScriptRequest";
    action: ContentScriptRequestAction.SendKey;
    data: { key: string; keyCode: KeyCode };
};

export type ContentScriptRequestMessage =
    | {
          type: "contentScriptRequest";
          action: ContentScriptRequestAction.RefreshState | ContentScriptRequestAction.ToggleHanYongMode;
      }
    | SendKeyRequestMessage;

export function isContentScriptRequestMessage(message: unknown): message is ContentScriptRequestMessage {
    return (
        hasProperties(message, "type", "action") &&
        message.type === "contentScriptRequest" &&
        Object.values(ContentScriptRequestAction).includes(message.action as ContentScriptRequestAction)
    );
}
