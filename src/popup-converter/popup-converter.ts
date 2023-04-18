"use strict";

import { HangulImeController } from "../composition/hangul-ime-controller";
import { romanize } from "../romanize";

type MessageResponse = { success: boolean; error?: string; };

chrome.runtime.onMessage.addListener((request, _sender, callback) => {
    const response: MessageResponse = { success: true };

    switch(request.action) {
        case 'fill':
            original.innerText = request.original;
            roman.innerText = request.roman;
            break;
            
        default:
            response.success = false;
            response.error = 'Invalid command';
            break;
    }
    
    callback(response);
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
    element.innerText = chrome.i18n.getMessage(element.dataset.message as string);
});

document.querySelectorAll("[data-placeholder-message]").forEach(el => {
    const element = el as HTMLElement;
    element.dataset.placeholder = chrome.i18n.getMessage(element.dataset.placeholderMessage as string);
});
