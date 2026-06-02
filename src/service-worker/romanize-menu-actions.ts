import { ServiceScriptMessage, ServiceScriptMessageAction } from "../messaging/service-to-content-messages";
import { PopupConverterData, popupConverterDataKey } from "./popup-converter/popup-converter-data";
import { romanize } from "../romanization/romanize";
import { sendMessageToTab } from "./send-message-to-tab";
import popupConverter from "url:./popup-converter/popup-converter.html";
import { api } from "../platform/browser-api";

export async function romanizeInPopup(event: chrome.contextMenus.OnClickData) {
    const selectionText = event.selectionText || "";
    const data: PopupConverterData = {
        original: selectionText,
        romanized: romanize(selectionText),
    };

    const newWindow = await api.windows.create({
        url: popupConverter,
        type: "popup",
        width: 600,
        height: 400,
    });

    if (newWindow?.id === undefined) {
        console.error("Failed to create popup window");
        return;
    }

    // Hand the text off via storage rather than messaging the new window on a
    // timer: the popup reads it on load, so there's no load-timing race and no
    // dependence on the window having a content script listening yet.
    await api.storage.session.set({ [popupConverterDataKey(newWindow.id)]: data });
}

export async function romanizeBeside(event: chrome.contextMenus.OnClickData, tab: chrome.tabs.Tab | undefined) {
    if (!tab?.id || !event.selectionText) {
        return;
    }

    if (!event.editable) {
        await romanizeInPopup(event);
        return;
    }

    const romanText = romanize(event.selectionText);

    await sendMessageToTab<ServiceScriptMessage>(tab.id, {
        type: "serviceScriptMessage",
        action: ServiceScriptMessageAction.InsertTextAfterSelection,
        data: romanText,
    });
}
