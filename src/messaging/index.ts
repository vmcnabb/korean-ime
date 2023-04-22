import { KeyCode } from "../content-script/on-screen-keyboard/korean-keyboard-map";
import { TabState } from "../extension-state/tab-state";

export type TabStateMessage = {
    type: "tabState",
    action: "update",
    data: TabState
}

export enum ContentScriptRequestAction {
    RefreshState = "refreshState",
    SendKey = "sendKey",
    ToggleHanYongMode = "toggleHanYongMode",
}

/**
 * Message sent from the content script to the background script
 */
type SendKeyMessage = {
    type: "contentScriptRequest",
    action: ContentScriptRequestAction.SendKey,
    data: {
        key: string,
        keyCode: KeyCode
    }
}

type BasicContentScriptMessage = {
    type: "contentScriptRequest",
    action: Exclude<ContentScriptRequestAction, ContentScriptRequestAction.SendKey>
}

export type ContentScriptMessage = SendKeyMessage | BasicContentScriptMessage;

export type ActionHandlers<TMessage, TMessageActions extends string> = {
    [K in TMessageActions]: (message: TMessage) => void;
};

export function isTabStateMessage(message: any): message is TabStateMessage {
    return message?.type === "tabState" && message?.action === "update";
}

export function isContentScriptRequest(message: any): message is ContentScriptMessage {
    return message
        && message.type === "contentScriptRequest"
        && Object.values(ContentScriptRequestAction).includes(message.action);
}

export function isSendKeyMessage(message: any): message is SendKeyMessage {
    return message?.type === "contentScriptRequest"
        && message?.action === ContentScriptRequestAction.SendKey;
}

export function isBasicContentScriptMessage(message: any): message is BasicContentScriptMessage {
    return message?.type === "contentScriptRequest"
        && message?.action !== ContentScriptRequestAction.SendKey;
}