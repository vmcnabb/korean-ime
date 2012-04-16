// Copyright © 2012 Vincent McNabb
(function() {
	// helper functions
	var isOnDomain = function(url) {
		if(!url) return true;

		var url = url.split('/')[2];
		
		return url.indexOf(document.domain) >= 0;
	}

	var getActiveElement = function(doc) {
		return (doc.activeElement && doc.activeElement.contentDocument) ?
			getActiveElement(doc.activeElement.contentDocument) :
			doc.activeElement;
	}

	// class data
	var state = {
		enabled: false
	}
	var editableElements = {}
	var nextId = 0;
	
	var processElement = function(el) {
		// assuming an @contenteditable, textarea, or any type of input
		if((el.tagName.toLowerCase() == 'input' && el.type.toLowerCase() != 'text')) return;
		
		var heId = el.dataset.heId = el.dataset.heId || nextId++;
		var ee = editableElements[heId];
		
		if(!ee) {
			var he = new HangeulEditor(el);
			ee = editableElements[heId] = {
				element: el,
				editor: he
			};
		}
		
		if(ee.editor.isHooked() != state.enabled) {
			if(state.enabled)
				ee.editor.hook();
			else
				ee.editor.unhook();
		}
	}
	
	var refreshEditableElements = function(doc) {
		if(!doc) return false;

		var elements = [];
		
		// we can't filter input on type=text here because it often throws an
		// error while iterating.
		var expr = "//*[@contenteditable]|//input|//textarea";
		var iterator = doc.evaluate(expr, doc);
		
		var el;
		while(el = iterator.iterateNext()) {
			elements.push(el);
		}
		for(var i in elements) processElement(elements[i]);
		
		var iframes = doc.getElementsByTagName('iframe');

		for(var i = 0; i < iframes.length; i++) {
			var f = iframes[i];

			// this won't work properly if the location of the iframe changes to or from the allowed domain
			if(!isOnDomain(f.src)) continue;
			
			refreshEditableElements(f.contentDocument);
		}
		
		return true;
	}
	
	// *** Interface for background.js ***

	var refresher;
	var enable = function() {
		if(!state.enabled) {
			state.enabled = true;
			refreshEditableElements(document);
			
			refresher = setInterval(function() {
				refreshEditableElements(document);
			}, 500);
		}
	}

	var disable = function() {
		if(state.enabled) {
			state.enabled = false;
			clearInterval(refresher);
			
			for(var key in editableElements) {
				var o = editableElements[key];
				o.editor.unhook();
			}
		}
	}

	chrome.extension.onRequest.addListener(function(request,sender,callback) {
		var response = {'state': state};
		
		switch(request.action) {
			case 'disable':
				disable();
				break;
				
			case 'enable':
				enable();
				break;
				
			case 'state':
				break;
				
			case 'insertAfter':
				var element = getActiveElement(document);
				if(element) {
					var sel = new SelectionEditor(element);
					sel.deselect();
					sel.insert(request.data);
					response.wasSuccessful = true;
				} else {
					response.wasSuccessful = false;
				}
				break;
		}
		if(callback) callback({'state': response});
	});
})();