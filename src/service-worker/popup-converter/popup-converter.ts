import { HangulImeController } from "../../composition/hangul-ime-controller";
import { romanize } from "../../romanization/romanize";
import { PopupConverterData, popupConverterDataKey } from "./popup-converter-data";

const original = document.getElementById("original") as HTMLDivElement,
    roman = document.getElementById("romanized") as HTMLDivElement,
    he = new HangulImeController(original);

he.activate();

void populateFromStorage();

/**
 * Load the text the service worker stashed for this popup. Reads the value if
 * it's already present, and also subscribes to storage in case the popup loads
 * before the worker finishes writing — either ordering populates exactly once.
 * The entry is removed once consumed so it doesn't linger in session storage.
 */
async function populateFromStorage() {
    const win = await chrome.windows.getCurrent();
    if (win.id === undefined) {
        return;
    }
    const key = popupConverterDataKey(win.id);

    const apply = (data: PopupConverterData) => {
        original.innerText = data.original;
        roman.innerText = data.romanized;
        void chrome.storage.session.remove(key);
    };

    chrome.storage.session.onChanged.addListener((changes) => {
        const data = changes[key]?.newValue as PopupConverterData | undefined;
        if (data) {
            apply(data);
        }
    });

    const existing = (await chrome.storage.session.get(key))[key] as PopupConverterData | undefined;
    if (existing) {
        apply(existing);
    }
}

function doRomanize() {
    roman.innerText = romanize(original.innerText);
}

he.onEntry(() => doRomanize());
original.oninput = doRomanize;

// Paste as plain text only — the input is a contenteditable, so a default paste
// would drop in the source's HTML/styling. insertText also fires `input`, which
// triggers doRomanize.
original.addEventListener("paste", (event) => {
    event.preventDefault();
    const text = event.clipboardData?.getData("text/plain") ?? "";
    document.execCommand("insertText", false, text);
});

document.querySelectorAll("[data-message]").forEach((el) => {
    const element = el as HTMLElement;
    element.innerText = element.dataset.message ? chrome.i18n.getMessage(element.dataset.message) : "";
});

document.querySelectorAll("[data-placeholder-message]").forEach((el) => {
    const element = el as HTMLElement;
    element.dataset.placeholder = element.dataset.placeholderMessage
        ? chrome.i18n.getMessage(element.dataset.placeholderMessage)
        : "";
});
