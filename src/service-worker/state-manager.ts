import { TabState } from "../extension-state/tab-state";
import { KoreanKeyboardMode } from "../extension-state/korean-keyboard-mode";
import icon16h from "url:../images/icon16h.png";
import icon16a from "url:../images/icon16a.png";
import {
    ServiceScriptMessage,
    ServiceScriptMessageAction,
    SendKeyServiceMessage,
} from "../messaging/service-to-content-messages";
import { menus } from "./menus";

/**
 * Manages extension state for all tabs
 */
export class StateManager {
    private static _instance: StateManager;
    private focusedFrames = new Map<number, number>(); // tabId → frameId

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

    public setFocusedFrame(tabId: number, frameId: number) {
        this.focusedFrames.set(tabId, frameId);
    }

    public async routeSendKey(
        tabId: number,
        data: SendKeyServiceMessage["data"]
    ) {
        const frameId = this.focusedFrames.get(tabId);
        if (frameId === undefined) {
            return;
        }
        const message: SendKeyServiceMessage = {
            type: "serviceScriptMessage",
            action: ServiceScriptMessageAction.SendKey,
            data,
        };
        try {
            await chrome.tabs.sendMessage(tabId, message, { frameId });
        } catch (error) {
            console.debug(`Failed to send key to frame ${frameId} in tab ${tabId}:`, error);
        }
    }

    public async toggleHanYongMode(tabId: number): Promise<void> {
        let newMode: KoreanKeyboardMode = KoreanKeyboardMode.Hangul;

        await this.setTabState(tabId, (tabState) => {
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

    public async updatePresentation(tabId: number) {
        const tabState = await this.getTabState(tabId);

        const isHangulMode =
            tabState.koreanKeyboardMode === KoreanKeyboardMode.Hangul;
        await chrome.action.setIcon({
            tabId: tabId,
            path: isHangulMode
                ? icon16h
                : icon16a,
        });

        // update on-screen-keyboard menu item to checked or not
        await chrome.contextMenus.update(menus.onScreenKeyboard.id, {
            checked: tabState.isOnScreenKeyboardEnabled,
        });
    }

    /**
     * Toggles the on-screen keyboard state for the given tab and returns the new state
     * @param tabId The ID of the tab for which to toggle the on-screen keyboard
     * @returns true if the on-screen keyboard is now enabled, false if it is now disabled
     */
    public async toggleOnScreenKeyboard(tabId: number): Promise<boolean> {
        const tabState = await this.getTabState(tabId);
        const newTabState = {
            ...tabState,
            isOnScreenKeyboardEnabled: !tabState.isOnScreenKeyboardEnabled,
        };
        await this.setTabState(tabId, () => newTabState);

        return newTabState.isOnScreenKeyboardEnabled;
    }

    /**
     * Updates the TabState and sends a message to the content scripts to update the state
     * @param tabId The ID of the tab for which to update the state
     * @param updateFn function that takes the current tab state and returns the new tab state
     */
    private async setTabState(
        tabId: number,
        updateFn: (tabState: TabState) => TabState
    ) {
        const currentTabState = await this.getTabState(tabId);
        const newTabState = updateFn(currentTabState);

        const storageKey = `tabState-${tabId}`;
        await chrome.storage.local.set({ [storageKey]: newTabState });

        await this.sendStateToTab(tabId);
        await this.updatePresentation(tabId);
    }

    public async sendStateToTab(tabId: number) {
        const tabState = await this.getTabState(tabId);
        try {
            await chrome.tabs.sendMessage<ServiceScriptMessage>(tabId, {
                type: "serviceScriptMessage",
                action: ServiceScriptMessageAction.UpdateState,
                data: tabState,
            });
        } catch (error) {
            // this is usually due to the target tab not having a content script (e.g. chrome://extensions), so we can ignore it
            console.debug(`Failed to send state to tab ${tabId}:`, error);
        }
    }

    private defaultTabState(): TabState {
        return {
            koreanKeyboardMode: KoreanKeyboardMode.English,
            isOnScreenKeyboardEnabled: false,
        };
    }

    private async getTabState(tabId: number): Promise<TabState> {
        const storageKey = `tabState-${tabId}`;
        const result = await chrome.storage.local.get(storageKey);
        const tabState = result[storageKey] as TabState | undefined;

        if (!tabState) {
            return this.defaultTabState();
        }

        return this.cloneTabState(tabState);
    }

    private cloneTabState(tabState: TabState): TabState {
        return { ...tabState };
    }
}
