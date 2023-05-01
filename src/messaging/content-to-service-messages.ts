// messages sent from content scripts to the background script

export enum ContentScriptRequestAction {
    /** request the tabstate from the service script */
    RefreshState = "refreshState",
    /** request the service script to toggle han/yong mode */
    ToggleHanYongMode = "toggleHanYongMode",
}

export type ContentScriptRequestMessage = {
    type: "contentScriptRequest",
    action: ContentScriptRequestAction.RefreshState
        | ContentScriptRequestAction.ToggleHanYongMode
}

export function isContentScriptRequestMessage(message: any): message is ContentScriptRequestMessage {
    return message
        && message.type === "contentScriptRequest"
        && Object.values(ContentScriptRequestAction).includes(message.action);
}
