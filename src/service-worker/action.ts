import { StateManager } from "./state-manager";

export function setupActionListener(stateManager: StateManager) {
    chrome.action.onClicked.addListener((tab) => {
        if (!tab.id) {
            return;
        }

        stateManager.toggleHanYongMode(tab.id);
    });
}
