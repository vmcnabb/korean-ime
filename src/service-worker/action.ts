import { StateManager } from "./state-manager";

export function setupActionListener() {
    chrome.action.onClicked.addListener(tab => {
        if (!tab.id) {
            return;
        }

        StateManager.instance.toggleHanYongMode(tab.id);
    });
}
