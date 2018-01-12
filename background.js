// Copyright © 2012-2018 Vincent McNabb
(() => {
	let tabStates = {};
	const converter = new HangeulConverter();

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
					sendResponse({ status: accepted });
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
				chrome.tabs.sendRequest(tab.id, {
					action: 'insertAfter',
					data: romanText
				});

			} else {
				// put text into popup window
				chrome.windows.create(
					{
						url: 'popup.html',
						type: 'popup',
						width: 540,
						height: 350
					},
					function (window) {
						chrome.tabs.sendRequest(
							window.tabs[0].id,
							{
								action: 'fill',
								original: event.selectionText,
								roman: romanText
							}
						);
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
			path: tabState.enabled ? 'icon16h.png' : 'icon16a.png'
		});

		chrome.tabs.sendMessage(
			tab.id,
			{
				action: tabState.enabled ? 'enable' : 'disable'
			}
		);
	}
})();
