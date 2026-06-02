import { debugLog } from "../debug-log";
import { api } from "../platform/browser-api";

// chrome.tabs.sendMessage rejects with "Receiving end does not exist" whenever
// the target tab/frame has no content script listening — chrome:// pages, the
// Web Store, PDFs, or a tab that hasn't loaded the content script yet. For a
// broadcast-style IME that's expected and harmless, so swallow it (logging at
// debug level) rather than letting it surface as an unhandled rejection.
export async function sendMessageToTab<M>(
    tabId: number,
    message: M,
    options?: chrome.tabs.MessageSendOptions
): Promise<void> {
    try {
        await api.tabs.sendMessage(tabId, message, options ?? {});
    } catch (error) {
        const frame = options?.frameId !== undefined ? ` (frame ${options.frameId})` : "";
        debugLog(`Failed to send message to tab ${tabId}${frame}:`, error);
    }
}
