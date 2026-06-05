/**
 * Persisted on-screen-keyboard layout. The position (corner anchor + offset) is
 * remembered per-site; the collapsed/minimised state is a single global value.
 * Both are stored by the service worker in `chrome.storage.local` and exchanged
 * with the content script via the layout messages (see `route-message` callers).
 */
export type KeyboardPlacement = {
    originX: "left" | "right";
    originY: "top" | "bottom";
    x: number;
    y: number;
};

export type OnScreenKeyboardLayout = {
    /** Per-site position; absent when the site has no saved position yet. */
    position?: KeyboardPlacement;
    /** Global minimised/maximised state. */
    collapsed: boolean;
};
