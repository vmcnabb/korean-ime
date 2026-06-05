/**
 * Typed dispatch for a discriminated message union.
 *
 * Each `onMessage` listener narrows a message with its `isX` type-guard and then
 * needs to fan out on `message.action`. Rather than hand-roll a `switch` at every
 * listener, pass a handler table keyed by action: `routeByAction` looks up the
 * handler for the message's action and calls it with the message narrowed to that
 * action's variant. An action with no entry is simply ignored.
 */
type ActionHandlers<M extends { action: string }> = {
    [A in M["action"]]?: (message: Extract<M, { action: A }>) => void;
};

export function routeByAction<M extends { action: string }>(message: M, handlers: ActionHandlers<M>): void {
    const handler = handlers[message.action as M["action"]] as ((message: M) => void) | undefined;
    handler?.(message);
}
