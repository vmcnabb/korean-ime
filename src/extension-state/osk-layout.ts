/**
 * Which key arrangement the on-screen keyboard shows. A user preference (synced
 * via settings), distinct from the per-site position/collapsed state below.
 */
export enum LayoutId {
    /** Alphabet keys only (jamo reference) plus Shift/Backspace/Space/한영. */
    Minimal = "minimal",
    /** Full PC keyboard, US: 한/영 and 한자 as secondary labels on Right Alt/Ctrl. */
    FullUs = "full-us",
    /** Full PC keyboard, Korean: dedicated 한자 / 한영 keys flanking a short space. */
    FullKorean = "full-korean",
}

export const defaultLayoutId = LayoutId.FullUs;

/** Whether a value is a known LayoutId (guards a stale/corrupt stored setting). */
export function isLayoutId(value: unknown): value is LayoutId {
    return Object.values(LayoutId).includes(value as LayoutId);
}

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
