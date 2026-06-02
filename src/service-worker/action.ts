import { StateManager } from "./state-manager";
import { api } from "../platform/browser-api";

export function setupActionListener(stateManager: StateManager) {
    api.action.onClicked.addListener((tab) => {
        if (!tab.id) {
            return;
        }

        stateManager.toggleHanYongMode(tab.id);
    });
}
