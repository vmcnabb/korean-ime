import { KeyCode } from "../keyboard/korean-keyboard-map";
import { hasProperties } from "../types/objects";
import { TabState } from "../extension-state/tab-state";
import { OnScreenKeyboardLayout } from "../extension-state/osk-layout";

export enum ServiceScriptMessageAction {
    InsertTextAfterSelection = "insertTextAfterSelection",
    UpdateState = "updateState",
    SendKey = "sendKey",
    OnScreenKeyboardLayout = "onScreenKeyboardLayout",
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

export type OnScreenKeyboardLayoutMessage = {
    type: "serviceScriptMessage";
    action: ServiceScriptMessageAction.OnScreenKeyboardLayout;
    data: OnScreenKeyboardLayout;
};

export type ServiceScriptMessage =
    | TabStateMessage
    | InsertTextAfterSelectionMessage
    | SendKeyServiceMessage
    | OnScreenKeyboardLayoutMessage;

export function isServiceScriptMessage(message: unknown): message is ServiceScriptMessage {
    return (
        hasProperties(message, "type", "action") &&
        message.type === "serviceScriptMessage" &&
        Object.values(ServiceScriptMessageAction).includes(message.action as ServiceScriptMessageAction)
    );
}
