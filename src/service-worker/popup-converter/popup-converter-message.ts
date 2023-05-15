import { hasProperties } from "../../types/objects";

export type PopulatePopupConverterMessage = {
    type: "populatePopupConverterMessage";
    action: "populate";
    data: {
        original: string;
        romanized: string;
    };
};

export function isPopulatePopupConverterMessage(
    message: unknown
): message is PopulatePopupConverterMessage {
    return (
        hasProperties(message, "type", "action") &&
        message.type === "populatePopupConverterMessage" &&
        message.action === "populate"
    );
}
