import { HangulEditor } from "../hangulEditor.js";

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
    he = new HangulEditor(original);

he.activate();

romanizeButton.onclick = () => roman.innerText = ime.converter.romanize(original.innerText);
