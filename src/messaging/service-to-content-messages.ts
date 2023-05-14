import { TabState } from "../extension-state/tab-state";

export enum ServiceScriptMessageAction {
    InsertTextAfterSelection = "insertTextAfterSelection",
    UpdateState = "updateState",
}

export namespace ServiceScriptMessage {
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
}

export type ServiceScriptMessage =
    | ServiceScriptMessage.TabStateMessage
    | ServiceScriptMessage.InsertTextAfterSelectionMessage;

export function isServiceScriptMessage(
    message: any
): message is ServiceScriptMessage {
    return (
        message &&
        message.type === "serviceScriptMessage" &&
        Object.values(ServiceScriptMessageAction).includes(message.action)
    );
}
