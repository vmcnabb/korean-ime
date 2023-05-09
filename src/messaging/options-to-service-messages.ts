export enum OptionsPageMessageAction {
    NotifyOptionsChanged = "notifyOptionsChanged"
}

export type OptionsPageMessage = {
    type: "optionsPageMessage",
    action: OptionsPageMessageAction
}

export function isOptionsPageMessage(message: any): message is OptionsPageMessage {
    return message
        && message.type === "optionsPageMessage"
        && Object.values(OptionsPageMessageAction).includes(message.action);
}
