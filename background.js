// Copyright © 2012 Vincent McNabb
var tabStates = {};
var hc = new HangeulConverter();
var options = {
	
};

var setState = function(tab,toggle) {
	var tabState = tabStates[tab.id] = tabStates[tab.id] || { enabled: false };
	
	if(toggle) tabState.enabled = !tabState.enabled;
	
	chrome.pageAction.setIcon({
		tabId: tab.id,
		path: tabState.enabled ? 'icon16h.png' : 'icon16a.png'
	});

	chrome.tabs.sendRequest(tab.id, {
		action: tabState.enabled ? 'enable' : 'disable'
	});
}

chrome.tabs.onUpdated.addListener(function(tabid, changeInfo, tab) {
	setState(tab);
	chrome.pageAction.show(tabid);
});


chrome.pageAction.onClicked.addListener(function(tab) {
	setState(tab,true);
});

chrome.contextMenus.create({
	type: 'normal',
	title: '&Romanize',
	contexts: ['selection'],
	onclick: function(event, tab) {
		var romanText = hc.romanize(event.selectionText);
		if(event.editable) {
			// insert the romanized text after the hangeul
			chrome.tabs.sendRequest(tab.id, {
				action: 'insertAfter',
				data: romanText
			});
		} else {
			// put text into popup window
			chrome.windows.create({
				url: 'popup.html',
				type: 'popup',
				width: 540,
				height: 350
			}, function(window) {
				console.log('sending message to ' + window.tabs[0].id);
				chrome.tabs.sendRequest(window.tabs[0].id, {
					action: 'fill',
					original: event.selectionText,
					roman: romanText
				});
			});
		}
	}
});