import { HangulImeController } from "../../composition/hangul-ime-controller";
import { romanize } from "../../romanize";
import { PopulatePopupConverterMessage } from "./popup-converter-message";

chrome.runtime.onMessage.addListener((request: PopulatePopupConverterMessage) => {
    switch(request.action) {
        case "populate":
            original.innerText = request.data.original;
            roman.innerText = request.data.romanized;
            break;
    }
});

const original = document.getElementById('original') as HTMLDivElement,
    roman = document.getElementById('romanized') as HTMLDivElement,
    he = new HangulImeController(original);

he.activate();

function doRomanize() {
    roman.innerText = romanize(original.innerText);
}

he.onEntry(() => doRomanize());
original.oninput = doRomanize;

document.querySelectorAll("[data-message]").forEach(el => {
    const element = el as HTMLElement;
    element.innerText = chrome.i18n.getMessage(element.dataset.message!);
});

document.querySelectorAll("[data-placeholder-message]").forEach(el => {
    const element = el as HTMLElement;
    element.dataset.placeholder = chrome.i18n.getMessage(element.dataset.placeholderMessage!);
});
