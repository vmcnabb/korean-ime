// Copyright © 2012-2018 Vincent McNabb
(ime => {
	let tabStates = {};
	const converter = ime.converter;

	chrome.tabs.onUpdated.addListener((tabid, changeInfo, tab) => {
		setState(tab);
		chrome.pageAction.show(tabid);
	});

	// icon is clicked
	chrome.pageAction.onClicked.addListener(tab => {
		setState(tab, true);
	});

	chrome.runtime.onMessage.addListener(
		function (request, sender, sendResponse) {
			switch (request.action) {
				case "toggle":
					setState(sender.tab, true);
					sendResponse({ status: "accepted" });
					break;
			}
		}
	);

	chrome.contextMenus.create({
		type: 'normal',
		title: '&Romanize',
		contexts: ['selection'],
		onclick: (event, tab) => {
			const romanText = converter.romanize(event.selectionText);

			if (event.editable) {
				// insert the romanized text after the hangeul
				chrome.tabs.sendMessage(
					tab.id,
					{
						action: 'insertAfter',
						data: romanText
					}
				);

			} else {
				// put text into popup window
				chrome.windows.create(
					{
						url: 'popup-converter/popup-converter.html',
						type: 'popup',
						width: 600,
						height: 400
					},
					function (window) {
						setTimeout(() => {
							chrome.tabs.sendRequest(
								window.tabs[0].id,
								{
									action: 'fill',
									original: event.selectionText,
									roman: romanText
								}
							);
						}, 100);
					}
				);
			}
		}
	});

	function setState (tab, toggle) {
		var tabState = tabStates[tab.id] = tabStates[tab.id] || { enabled: false };
		
		if (toggle) tabState.enabled = !tabState.enabled;
		
		chrome.pageAction.setIcon({
			tabId: tab.id,
			path: tabState.enabled ? 'images/icon16h.png' : 'images/icon16a.png'
		});

		chrome.tabs.sendMessage(
			tab.id,
			{
				action: tabState.enabled ? 'enable' : 'disable'
			}
		);
	}
})(window.koreanIme);
