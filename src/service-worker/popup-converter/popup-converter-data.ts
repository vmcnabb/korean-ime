/**
 * The text handed to a romanize popup. The service worker writes it to
 * `storage.session` keyed by the popup's window id; the popup reads it on load.
 * Using storage (rather than messaging a freshly created window on a timer)
 * removes the load-timing race and survives a service-worker respawn.
 */
export type PopupConverterData = {
    original: string;
    romanized: string;
};

/** storage.session key holding the pending data for a given popup window. */
export function popupConverterDataKey(windowId: number): string {
    return `popupConverterData-${windowId}`;
}
