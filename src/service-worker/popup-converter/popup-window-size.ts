import { debugLog } from "../../debug-log";
import { api } from "../../platform/browser-api";

export type PopupWindowSize = {
    width: number;
    height: number;
};

export const defaultPopupWindowSize: PopupWindowSize = {
    width: 600,
    height: 400,
};

const LOCAL_SIZE_KEY = "romanizePopupWindowSize";
const SESSION_WINDOW_KEY_PREFIX = "romanizePopupWindow-";
const MIN_WIDTH = 420;
const MIN_HEIGHT = 280;
const MAX_WIDTH = 2400;
const MAX_HEIGHT = 1600;

function sessionWindowKey(windowId: number): string {
    return `${SESSION_WINDOW_KEY_PREFIX}${windowId}`;
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(Math.round(value), min), max);
}

export function normalizePopupWindowSize(value: unknown): PopupWindowSize | undefined {
    if (typeof value !== "object" || value === null) {
        return undefined;
    }

    const size = value as Partial<Record<keyof PopupWindowSize, unknown>>;
    if (typeof size.width !== "number" || typeof size.height !== "number") {
        return undefined;
    }
    if (!Number.isFinite(size.width) || !Number.isFinite(size.height)) {
        return undefined;
    }

    return {
        width: clamp(size.width, MIN_WIDTH, MAX_WIDTH),
        height: clamp(size.height, MIN_HEIGHT, MAX_HEIGHT),
    };
}

function sizeFromWindow(window: chrome.windows.Window, fallback: PopupWindowSize): PopupWindowSize {
    return (
        normalizePopupWindowSize({
            width: window.width ?? fallback.width,
            height: window.height ?? fallback.height,
        }) ?? fallback
    );
}

export async function loadPopupWindowSize(): Promise<PopupWindowSize> {
    const stored = (await api.storage.local.get(LOCAL_SIZE_KEY))[LOCAL_SIZE_KEY];
    return normalizePopupWindowSize(stored) ?? defaultPopupWindowSize;
}

export async function trackPopupWindowSize(
    window: chrome.windows.Window,
    fallback: PopupWindowSize = defaultPopupWindowSize
): Promise<void> {
    if (window.id === undefined) {
        return;
    }

    await api.storage.session.set({ [sessionWindowKey(window.id)]: sizeFromWindow(window, fallback) });
}

export function setupPopupWindowSizeTracking(): void {
    api.windows.onBoundsChanged.addListener((window) => {
        if (window.id === undefined) {
            return;
        }

        void updateTrackedWindowSize(window).catch((error) => debugLog("popup size update failed:", error));
    });

    api.windows.onRemoved.addListener((windowId) => {
        void saveClosedPopupWindowSize(windowId).catch((error) => debugLog("popup size save failed:", error));
    });
}

async function updateTrackedWindowSize(window: chrome.windows.Window): Promise<void> {
    if (window.id === undefined) {
        return;
    }

    const key = sessionWindowKey(window.id);
    const tracked = normalizePopupWindowSize((await api.storage.session.get(key))[key]);
    if (!tracked) {
        return;
    }

    await api.storage.session.set({ [key]: sizeFromWindow(window, tracked) });
}

async function saveClosedPopupWindowSize(windowId: number): Promise<void> {
    const key = sessionWindowKey(windowId);
    const size = normalizePopupWindowSize((await api.storage.session.get(key))[key]);
    if (size) {
        await api.storage.local.set({ [LOCAL_SIZE_KEY]: size });
    }
    await api.storage.session.remove(key);
}
