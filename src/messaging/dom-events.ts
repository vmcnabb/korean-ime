export interface KimeEvent extends Event {
    isKimeEvent: true;
}

export function isKimeEvent<T extends Event>(event: T | KimeEvent): event is KimeEvent & T {
    return "isKimeEvent" in event && event.isKimeEvent === true;
}

/**
 * Used to mark an event as a Kime event. This is used to prevent Kime from
 * processing events that it has already processed.
 * @param event
 */
export function setAsKimeEvent(event: Event) {
    (event as KimeEvent).isKimeEvent = true;
}

/**
 * Fully swallow a keyboard event so neither the page nor a rich editor acts on
 * the key we've handled ourselves. Shared by the composition and Hanja paths.
 */
export function cancelEvent(event: Event) {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
}
