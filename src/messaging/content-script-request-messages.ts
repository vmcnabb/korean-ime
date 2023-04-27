// messages sent from content scripts to the background script

import { SupportedCompositionFeatures } from "src/composition/composition-adapters/composition-adapter";
import { KeyCode } from "src/content-script/on-screen-keyboard/korean-keyboard-map";

export enum ContentScriptRequestAction {
    RefreshState = "refreshState",
    SendKey = "sendKey",
    ToggleHanYongMode = "toggleHanYongMode",
    UpdateCompositionFeatures = "updateCompositionFeatures",
    /**
     * Notify the background script that there is no active element on the page.
     */
    NoActiveElement = "noActiveElement"
}

export type ContentScriptMessage = SendKeyMessage | BasicContentScriptMessage | UpdateCompositionFeaturesMessage;

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
    action: ContentScriptRequestAction.RefreshState
        | ContentScriptRequestAction.ToggleHanYongMode
        | ContentScriptRequestAction.NoActiveElement
}

type UpdateCompositionFeaturesMessage = {
    type: "contentScriptRequest",
    action: ContentScriptRequestAction.UpdateCompositionFeatures,
    data: SupportedCompositionFeatures
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
        && (message?.action === ContentScriptRequestAction.RefreshState
            || message?.action === ContentScriptRequestAction.ToggleHanYongMode
            || message?.action === ContentScriptRequestAction.NoActiveElement);
}

export function isUpdateCompositionFeaturesMessage(message: any): message is UpdateCompositionFeaturesMessage {
    return message?.type === "contentScriptRequest"
        && message?.action === ContentScriptRequestAction.UpdateCompositionFeatures;
}
