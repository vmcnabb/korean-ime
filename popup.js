(function() {
	console.log('initialising popup');
	
	var original = document.getElementById('original');
	var roman = document.getElementById('romanized');
	var romanize = document.getElementById('romanize');
	var hc = new HangeulConverter();
	
	var he = new HangeulEditor(original);
	he.hook();

	chrome.extension.onRequest.addListener(function(request,sender,callback) {
		var response = { success: true };
		console.log('received request');
		
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
	
	romanize.onclick = function() {
		roman.innerText = hc.romanize(original.innerText);
	}
})();
