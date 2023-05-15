import {
    ServiceScriptMessage,
    ServiceScriptMessageAction,
} from "../messaging/service-to-content-messages";
import { PopulatePopupConverterMessage } from "./popup-converter/popup-converter-message";
import { romanize } from "../romanization/romanize";
import popupConverter from "./popup-converter/popup-converter.html";

export function romanizeInPopup(event: chrome.contextMenus.OnClickData) {
    const selectionText = event.selectionText || "";
    const romanText = romanize(selectionText);

    // put text into popup window
    chrome.windows.create(
        {
            url: popupConverter,
            type: "popup",
            width: 600,
            height: 400,
        },
        function (newWindow) {
            setTimeout(() => {
                if (!newWindow?.tabs || !newWindow.tabs[0].id) {
                    console.error("Failed to create popup window");
                    return;
                }

                chrome.tabs.sendMessage<PopulatePopupConverterMessage>(
                    newWindow.tabs[0].id,
                    {
                        type: "populatePopupConverterMessage",
                        action: "populate",
                        data: {
                            original: selectionText,
                            romanized: romanText,
                        },
                    }
                );
            }, 100);
        }
    );
}

export function romanizeBeside(
    event: chrome.contextMenus.OnClickData,
    tab: chrome.tabs.Tab | undefined
) {
    if (!tab?.id || !event.selectionText) {
        return;
    }

    if (!event.editable) {
        return romanizeInPopup(event);
    }

    const romanText = romanize(event.selectionText);

    chrome.tabs.sendMessage<ServiceScriptMessage>(tab.id, {
        type: "serviceScriptMessage",
        action: ServiceScriptMessageAction.InsertTextAfterSelection,
        data: romanText,
    });
}
