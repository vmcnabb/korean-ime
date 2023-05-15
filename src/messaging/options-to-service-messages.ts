import { hasProperties } from "src/types/objects";

export enum OptionsPageMessageAction {
    NotifyOptionsChanged = "notifyOptionsChanged",
}

export type OptionsPageMessage = {
    type: "optionsPageMessage";
    action: OptionsPageMessageAction;
};

export function isOptionsPageMessage(
    message: unknown
): message is OptionsPageMessage {
    return (
        hasProperties(message, "type", "action") &&
        message.type === "optionsPageMessage" &&
        Object.values(OptionsPageMessageAction).includes(
            message.action as OptionsPageMessageAction
        )
    );
}
