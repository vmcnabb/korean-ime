(ime => {
    chrome.extension.onRequest.addListener((request, sender, callback) => {
        var response = { success: true };

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

    var original = document.getElementById('original'),
        roman = document.getElementById('romanized'),
        romanizeButton = document.getElementById('romanize'),
        he = new ime.HangeulEditor(original);

    he.activate();

    romanizeButton.onclick = () => roman.innerText = ime.converter.romanize(original.innerText);
})(window.koreanIme);
