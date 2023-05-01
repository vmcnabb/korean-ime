import { TabState } from "../extension-state/tab-state";

export enum ServiceScriptMessageActions {
    InsertTextAfterSelection = "insertTextAfterSelection",
    UpdateState = "updateState"
}

export namespace ServiceScriptMessage {
    export type TabStateMessage = {
        type: "serviceScriptMessage",
        action: ServiceScriptMessageActions.UpdateState,
        data: TabState
    }

    export type InsertTextAfterSelectionMessage = {
        type: "serviceScriptMessage"
        action: ServiceScriptMessageActions.InsertTextAfterSelection,
        data: string
    }
}
export type ServiceScriptMessage = ServiceScriptMessage.TabStateMessage | ServiceScriptMessage.InsertTextAfterSelectionMessage;

export function isServiceScriptMessage(message: any): message is ServiceScriptMessage {
    return message
        && message.type === "serviceScriptMessage"
        && Object.values(ServiceScriptMessageActions).includes(message.action);
}
