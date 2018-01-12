(() => {
	chrome.extension.onRequest.addListener((request,sender,callback) => {
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
		
		return response;
	});

	var original = document.getElementById('original'),
		roman = document.getElementById('romanized'),
		romanizeButton = document.getElementById('romanize'),
		hc = new HangeulConverter(),
		he = new HangeulEditor(original);

	he.hook();

	romanizeButton.onclick = () => {
		roman.innerText = hc.romanize(original.innerText);
	};
})();
