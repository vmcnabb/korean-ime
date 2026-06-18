/**
 * @jest-environment node
 */
import {
    defaultPopupWindowSize,
    loadPopupWindowSize,
    normalizePopupWindowSize,
    setupPopupWindowSizeTracking,
    trackPopupWindowSize,
} from "./popup-window-size";

let local: Record<string, unknown>;
let session: Record<string, unknown>;
let boundsChangedListeners: ((window: chrome.windows.Window) => void)[];
let removedListeners: ((windowId: number) => void)[];

function area(store: () => Record<string, unknown>) {
    return {
        get: jest.fn(async (key: string | string[]) => {
            const wanted = Array.isArray(key) ? key : [key];
            return Object.fromEntries(wanted.map((k) => [k, store()[k]]));
        }),
        set: jest.fn(async (items: Record<string, unknown>) => {
            Object.assign(store(), items);
        }),
        remove: jest.fn(async (keys: string | string[]) => {
            for (const key of Array.isArray(keys) ? keys : [keys]) {
                delete store()[key];
            }
        }),
    };
}

function popupWindow(overrides: Partial<chrome.windows.Window>): chrome.windows.Window {
    return {
        focused: true,
        alwaysOnTop: false,
        incognito: false,
        ...overrides,
    };
}

beforeEach(() => {
    local = {};
    session = {};
    boundsChangedListeners = [];
    removedListeners = [];

    Object.assign(globalThis, {
        chrome: {
            storage: {
                local: area(() => local),
                session: area(() => session),
            },
            windows: {
                onBoundsChanged: {
                    addListener: jest.fn((listener: (window: chrome.windows.Window) => void) => {
                        boundsChangedListeners.push(listener);
                    }),
                },
                onRemoved: {
                    addListener: jest.fn((listener: (windowId: number) => void) => {
                        removedListeners.push(listener);
                    }),
                },
            },
        },
    });
});

describe("popup-window-size", () => {
    it("uses the default size when nothing has been saved", async () => {
        await expect(loadPopupWindowSize()).resolves.toEqual(defaultPopupWindowSize);
    });

    it("loads a saved size and normalizes corrupt extremes", async () => {
        local.romanizePopupWindowSize = { width: 900.4, height: 700.6 };
        await expect(loadPopupWindowSize()).resolves.toEqual({ width: 900, height: 701 });

        expect(normalizePopupWindowSize({ width: 10, height: 9000 })).toEqual({ width: 420, height: 1600 });
        expect(normalizePopupWindowSize({ width: "wide", height: 400 })).toBeUndefined();
    });

    it("tracks only windows explicitly opened as romanization popups", async () => {
        setupPopupWindowSizeTracking();
        await trackPopupWindowSize(popupWindow({ id: 7, width: 600, height: 400 }));

        boundsChangedListeners[0](popupWindow({ id: 8, width: 1000, height: 800 }));
        await Promise.resolve();

        expect(session["romanizePopupWindow-7"]).toEqual({ width: 600, height: 400 });
        expect(session["romanizePopupWindow-8"]).toBeUndefined();
    });

    it("updates tracked bounds and saves the last size when the popup closes", async () => {
        setupPopupWindowSizeTracking();
        await trackPopupWindowSize(popupWindow({ id: 9, width: 600, height: 400 }));

        boundsChangedListeners[0](popupWindow({ id: 9, width: 720, height: 520 }));
        await Promise.resolve();
        await Promise.resolve();

        removedListeners[0](9);
        await Promise.resolve();
        await Promise.resolve();

        expect(local.romanizePopupWindowSize).toEqual({ width: 720, height: 520 });
        expect(session["romanizePopupWindow-9"]).toBeUndefined();
    });
});
