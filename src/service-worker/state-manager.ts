import { TabState } from "../extension-state/tab-state";
import { KoreanKeyboardMode } from "../extension-state/korean-keyboard-mode";
import icon16h from "../images/icon16h.png";
import icon16a from "../images/icon16a.png";
import {
    ServiceScriptMessage,
    ServiceScriptMessageAction,
} from "../messaging/service-to-content-messages";
import { menus } from "./menus";

/**
 * Manages extension state for all tabs
 */
export class StateManager {
    private static _instance: StateManager;
    private tabStates = new Map<number, TabState>();

    private constructor() {
        // ensure we are only referenced from the service worker
        if (!chrome.runtime.onMessage) {
            throw new Error(
                "StateManager can only be used from the service worker"
            );
        }
    }

    static get instance(): StateManager {
        if (!StateManager._instance) {
            StateManager._instance = new StateManager();
        }
        return StateManager._instance;
    }

    public toggleHanYongMode(tabId: number): void {
        let newMode: KoreanKeyboardMode = KoreanKeyboardMode.Hangul;

        this.setTabState(tabId, (tabState) => {
            const currentMode = tabState.koreanKeyboardMode;

            switch (currentMode) {
                case KoreanKeyboardMode.English:
                    newMode = KoreanKeyboardMode.Hangul;
                    break;
                case KoreanKeyboardMode.Hangul:
                    newMode = KoreanKeyboardMode.English;
                    break;
            }

            return {
                ...tabState,
                koreanKeyboardMode: newMode,
            };
        });
    }

    updatePresentation(tabId: number) {
        const tabState = this.getTabState(tabId);

        const isHangulMode =
            tabState.koreanKeyboardMode === KoreanKeyboardMode.Hangul;
        chrome.action.setIcon({
            tabId: tabId,
            path: isHangulMode ? icon16h : icon16a,
        });

        // update on-screen-keyboard menu item to checked or not
        chrome.contextMenus.update(menus.onScreenKeyboard.id, {
            checked: tabState.isOnScreenKeyboardEnabled,
        });
    }

    public toggleOnScreenKeyboard(tabId: number): boolean {
        const tabState = this.getTabState(tabId);
        const newTabState = {
            ...tabState,
            isOnScreenKeyboardEnabled: !tabState.isOnScreenKeyboardEnabled,
        };
        this.setTabState(tabId, () => newTabState);

        return newTabState.isOnScreenKeyboardEnabled;
    }

    /**
     * Updates the TabState and sends a message to the content scripts to update the state
     * @param tabId
     * @param updateFn function that takes the current tab state and returns the new tab state
     */
    private setTabState(
        tabId: number,
        updateFn: (tabState: TabState) => TabState
    ) {
        const currentTabState = this.getTabState(tabId);
        const newTabState = updateFn(currentTabState);

        this.tabStates.set(tabId, newTabState);

        this.sendStateToTab(tabId);
        this.updatePresentation(tabId);
    }

    public sendStateToTab(tabId: number) {
        const tabState = this.getTabState(tabId);
        chrome.tabs.sendMessage<ServiceScriptMessage>(tabId, {
            type: "serviceScriptMessage",
            action: ServiceScriptMessageAction.UpdateState,
            data: tabState,
        });
    }

    private defaultTabState(): TabState {
        return {
            koreanKeyboardMode: KoreanKeyboardMode.English,
            isOnScreenKeyboardEnabled: false,
        };
    }

    private getTabState(tabId: number): TabState {
        const tabState = this.tabStates.get(tabId);

        if (!tabState) {
            return this.defaultTabState();
        }

        return this.cloneTabState(tabState);
    }

    private cloneTabState(tabState: TabState): TabState {
        return { ...tabState };
    }
}
