import { HangeulEditor } from "../hangeulEditor.js";
import { romanize } from "../hangeulConverter.js";

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
    romanizeButton = document.getElementById('romanize'),
    he = new HangeulEditor(original);

he.activate();

function doRomanize() {
    roman.innerText = romanize(original.innerText);
}

he.onentry = doRomanize;
original.oninput = doRomanize;
