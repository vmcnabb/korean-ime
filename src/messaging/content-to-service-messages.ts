// messages sent from content scripts to the background script

import { KeyCode } from "../keyboard/korean-keyboard-map";
import { KeyboardPlacement } from "../extension-state/osk-layout";
import { hasProperties } from "../types/objects";

export enum ContentScriptRequestAction {
    /** request the TabState from the service script */
    RefreshState = "refreshState",
    /** request the service script to toggle han/yong mode */
    ToggleHanYongMode = "toggleHanYongMode",
    /** request the service script to route a key to the focused frame */
    SendKey = "sendKey",
    /** request the service script to turn the on-screen keyboard off */
    DisableOnScreenKeyboard = "disableOnScreenKeyboard",
    /** request the saved on-screen-keyboard layout for this site */
    RequestOnScreenKeyboardLayout = "requestOnScreenKeyboardLayout",
    /** ask the service script to persist the on-screen-keyboard layout */
    PersistOnScreenKeyboardLayout = "persistOnScreenKeyboardLayout",
}

export type SendKeyRequestMessage = {
    type: "contentScriptRequest";
    action: ContentScriptRequestAction.SendKey;
    data: { key: string; keyCode: KeyCode };
};

export type RequestOnScreenKeyboardLayoutMessage = {
    type: "contentScriptRequest";
    action: ContentScriptRequestAction.RequestOnScreenKeyboardLayout;
    data: { site?: string };
};

export type PersistOnScreenKeyboardLayoutMessage = {
    type: "contentScriptRequest";
    action: ContentScriptRequestAction.PersistOnScreenKeyboardLayout;
    data: { site?: string; position?: KeyboardPlacement; collapsed?: boolean; keyUnit?: number };
};

export type ContentScriptRequestMessage =
    | {
          type: "contentScriptRequest";
          action:
              | ContentScriptRequestAction.RefreshState
              | ContentScriptRequestAction.ToggleHanYongMode
              | ContentScriptRequestAction.DisableOnScreenKeyboard;
      }
    | SendKeyRequestMessage
    | RequestOnScreenKeyboardLayoutMessage
    | PersistOnScreenKeyboardLayoutMessage;

export function isContentScriptRequestMessage(message: unknown): message is ContentScriptRequestMessage {
    return (
        hasProperties(message, "type", "action") &&
        message.type === "contentScriptRequest" &&
        Object.values(ContentScriptRequestAction).includes(message.action as ContentScriptRequestAction)
    );
}
