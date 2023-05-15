// messages sent from content scripts to the background script

import { hasProperties } from "src/types/objects";

export enum ContentScriptRequestAction {
    /** request the TabState from the service script */
    RefreshState = "refreshState",
    /** request the service script to toggle han/yong mode */
    ToggleHanYongMode = "toggleHanYongMode",
}

export type ContentScriptRequestMessage = {
    type: "contentScriptRequest";
    action:
        | ContentScriptRequestAction.RefreshState
        | ContentScriptRequestAction.ToggleHanYongMode;
};

export function isContentScriptRequestMessage(
    message: unknown
): message is ContentScriptRequestMessage {
    return (
        hasProperties(message, "type", "action") &&
        message.type === "contentScriptRequest" &&
        Object.values(ContentScriptRequestAction).includes(
            message.action as ContentScriptRequestAction
        )
    );
}
