import { KoreanKeyboardMode } from "../extension-state/korean-keyboard-mode";
import { StateManager } from "./state-manager";

export function setupActionListener() {
    chrome.action.onClicked.addListener(tab => {
        if (!tab.id) {
            return;
        }

        toggleImeActive(tab.id);
    });
}

function toggleImeActive(tabId: number) {
    const isHangulMode = StateManager.instance.toggleHanYongMode(tabId) === KoreanKeyboardMode.Hangul;

    chrome.action.setIcon({
        tabId: tabId,
        path: isHangulMode ? 'images/icon16h.png' : 'images/icon16a.png'
    });
}
