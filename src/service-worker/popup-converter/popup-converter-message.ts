export type PopulatePopupConverterMessage = {
    type: "populatePopupConverterMessage",
    action: "populate",
    data: {
        original: string,
        romanized: string
    }
}

export function isPopulatePopupConverterMessage(message: any): message is PopulatePopupConverterMessage {
    return message?.type === "populatePopupConverterMessage" && message?.action === "populate";
}
