import { HangulEditor } from "../hangulEditor";
import { romanize } from "../romanize";

chrome.extension.onRequest.addListener((request, sender, callback) => {
    const response = { success: true };

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

const original = document.getElementById('original'),
    roman = document.getElementById('romanized'),
    he = new HangulEditor(original);

he.activate();

function doRomanize() {
    roman.innerText = romanize(original.innerText);
}

he.onentry = doRomanize;
original.oninput = doRomanize;

document.querySelectorAll("[data-message]").forEach(el => {
    el.innerText = chrome.i18n.getMessage(el.dataset.message);
});

document.querySelectorAll("[data-placeholder-message]").forEach(el => {
    el.dataset.placeholder = chrome.i18n.getMessage(el.dataset.placeholderMessage);
});
