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
