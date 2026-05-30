import { KeyCode } from "../content-script/on-screen-keyboard/korean-keyboard-map";
import { hasProperties } from "../types/objects";
import { TabState } from "../extension-state/tab-state";

export enum ServiceScriptMessageAction {
    InsertTextAfterSelection = "insertTextAfterSelection",
    UpdateState = "updateState",
    SendKey = "sendKey",
}

export type TabStateMessage = {
    type: "serviceScriptMessage";
    action: ServiceScriptMessageAction.UpdateState;
    data: TabState;
};

export type InsertTextAfterSelectionMessage = {
    type: "serviceScriptMessage";
    action: ServiceScriptMessageAction.InsertTextAfterSelection;
    data: string;
};

export type SendKeyServiceMessage = {
    type: "serviceScriptMessage";
    action: ServiceScriptMessageAction.SendKey;
    data: { key: string; keyCode: KeyCode };
};

export type ServiceScriptMessage = TabStateMessage | InsertTextAfterSelectionMessage | SendKeyServiceMessage;

export function isServiceScriptMessage(message: unknown): message is ServiceScriptMessage {
    return (
        hasProperties(message, "type", "action") &&
        message.type === "serviceScriptMessage" &&
        Object.values(ServiceScriptMessageAction).includes(message.action as ServiceScriptMessageAction)
    );
}
