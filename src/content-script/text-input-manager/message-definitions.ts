import { KeyCode } from "../on-screen-keyboard/korean-keyboard-map"

export enum TextInputMessageActions {
    InsertTextAfterSelection = "insertTextAfterSelection",
    TypeKey = "typeKey",
}

// this definition for "insertTextAfterSelection"
type InsertTextAfterSelectionMessage = {
    type: "textInputMessage"
    action: TextInputMessageActions.InsertTextAfterSelection,
    data: string
}

// this definition for "typeKey"
type TypeKeyMessage = {
    type: "textInputMessage"
    action: TextInputMessageActions.TypeKey,
    data: {
        key: string,
        keyCode: KeyCode
    }
}

export type TextInputMessage = InsertTextAfterSelectionMessage | TypeKeyMessage;

export function isTextInputMessage(message: any): message is TextInputMessage {
    return message
        && message.type === "textInputMessage"
        && Object.values(TextInputMessageActions).includes(message.action);
}

export function isInsertTextAfterSelectionMessage(message: any): message is InsertTextAfterSelectionMessage {
    return message
        && message.type === "textInputMessage"
        && message.action === TextInputMessageActions.InsertTextAfterSelection;
}

export function isTypeKeyMessage(message: any): message is TypeKeyMessage {
    return message 
        && message.type === "textInputMessage"
        && message.action === TextInputMessageActions.TypeKey;
}
