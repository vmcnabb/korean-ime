/**
 * @jest-environment node
 *
 * Pure logic over the chrome.* storage/tabs APIs, no DOM — run in the `node`
 * env (project default is jsdom) so `structuredClone` and friends match the
 * browser runtimes the service worker actually ships to.
 */
import { StateManager } from "./state-manager";
import { Persistence, Settings, defaultSettings } from "../settings/settings";
import { KoreanKeyboardMode } from "../extension-state/korean-keyboard-mode";
import { TabState } from "../extension-state/tab-state";

// `url:` asset imports reached transitively (state-manager → menus →
// romanize-menu-actions). Parcel resolves these at build time; stub them here.
jest.mock("url:../images/icon16h.png", () => "icon16h", { virtual: true });
jest.mock("url:../images/icon16a.png", () => "icon16a", { virtual: true });
jest.mock("url:./popup-converter/popup-converter.html", () => "popup.html", { virtual: true });

// In-memory stand-ins for the three storage areas the manager touches.
let sync: Record<string, unknown>;
let session: Record<string, unknown>;
let local: Record<string, unknown>;
let tabs: { id: number; active?: boolean }[];
let sentMessages: { tabId: number; data: TabState }[];

function area(store: () => Record<string, unknown>) {
    return {
        get: jest.fn(async (key: string | null) => {
            if (key === null) {
                return { ...store() };
            }
            return key in store() ? { [key]: store()[key] } : {};
        }),
        set: jest.fn(async (items: Record<string, unknown>) => {
            Object.assign(store(), items);
        }),
        remove: jest.fn(async (keys: string[]) => {
            for (const key of keys) {
                delete store()[key];
            }
        }),
    };
}

beforeEach(() => {
    sync = {};
    session = {};
    local = {};
    tabs = [{ id: 1, active: true }];
    sentMessages = [];

    Object.assign(globalThis, {
        chrome: {
            runtime: { onMessage: {} },
            storage: {
                sync: area(() => sync),
                session: area(() => session),
                local: area(() => local),
            },
            tabs: {
                query: jest.fn(async (q: { active?: boolean }) => (q.active ? tabs.filter((t) => t.active) : tabs)),
                sendMessage: jest.fn(async (tabId: number, message: { data: TabState }) => {
                    sentMessages.push({ tabId, data: message.data });
                }),
            },
            action: { setIcon: jest.fn(async () => {}) },
            contextMenus: { update: jest.fn(async () => {}) },
        },
    });
});

function withSettings(
    overrides: Partial<Settings> & {
        onScreenKeyboard?: Partial<Settings["onScreenKeyboard"]>;
        hanYong?: Partial<Settings["hanYong"]>;
    }
) {
    sync = {
        ...defaultSettings,
        ...overrides,
        onScreenKeyboard: { ...defaultSettings.onScreenKeyboard, ...overrides.onScreenKeyboard },
        hanYong: { ...defaultSettings.hanYong, ...overrides.hanYong },
    };
}

function lastSentTo(tabId: number): TabState | undefined {
    return [...sentMessages].reverse().find((m) => m.tabId === tabId)?.data;
}

describe("initial state derivation", () => {
    it("AlwaysOff starts the feature off", async () => {
        withSettings({ onScreenKeyboard: { persistence: Persistence.AlwaysOff } });
        const manager = new StateManager();

        await manager.sendStateToTab(1);

        expect(lastSentTo(1)?.isOnScreenKeyboardEnabled).toBe(false);
    });

    it("AlwaysOn starts the feature on", async () => {
        withSettings({ onScreenKeyboard: { persistence: Persistence.AlwaysOn } });
        const manager = new StateManager();

        await manager.sendStateToTab(1);

        expect(lastSentTo(1)?.isOnScreenKeyboardEnabled).toBe(true);
    });

    it("AlwaysOn for Han/Yong starts in Hangul mode", async () => {
        withSettings({ hanYong: { persistence: Persistence.AlwaysOn } });
        const manager = new StateManager();

        await manager.sendStateToTab(1);

        expect(lastSentTo(1)?.koreanKeyboardMode).toBe(KoreanKeyboardMode.Hangul);
    });

    it("KeepLastState restores the remembered value from storage.local", async () => {
        withSettings({ onScreenKeyboard: { persistence: Persistence.KeepLastState } });
        local.lastState = { isOnScreenKeyboardEnabled: true };
        const manager = new StateManager();

        await manager.sendStateToTab(1);

        expect(lastSentTo(1)?.isOnScreenKeyboardEnabled).toBe(true);
    });

    it("falls back to off for a corrupt/unknown persistence value in storage", async () => {
        // Simulates stale storage.sync data that slips past loadSettings' typeof check.
        sync = {
            ...defaultSettings,
            onScreenKeyboard: { persistence: "some-removed-value" as unknown as Persistence },
        };
        const manager = new StateManager();

        await manager.sendStateToTab(1);

        expect(lastSentTo(1)?.isOnScreenKeyboardEnabled).toBe(false);
    });
});

describe("KeepLastState persistence", () => {
    it("writes the toggled value to storage.local", async () => {
        withSettings({ onScreenKeyboard: { persistence: Persistence.KeepLastState } });
        const manager = new StateManager();

        await manager.toggleOnScreenKeyboard(1);

        expect((local.lastState as Partial<TabState>).isOnScreenKeyboardEnabled).toBe(true);
    });

    it("does NOT persist when the feature is AlwaysOff", async () => {
        withSettings({ onScreenKeyboard: { persistence: Persistence.AlwaysOff } });
        const manager = new StateManager();

        await manager.toggleOnScreenKeyboard(1);

        expect((local.lastState as Partial<TabState> | undefined)?.isOnScreenKeyboardEnabled).toBeUndefined();
    });

    it("does not touch storage.local when neither feature is KeepLastState", async () => {
        withSettings({
            onScreenKeyboard: { persistence: Persistence.AlwaysOff },
            hanYong: { persistence: Persistence.AlwaysOn },
        });
        const manager = new StateManager();

        await manager.toggleOnScreenKeyboard(1);

        expect(chrome.storage.local.set).not.toHaveBeenCalled();
    });
});

describe("share across tabs", () => {
    it("fans a toggle out to every open tab", async () => {
        withSettings({ shareAcrossTabs: true });
        tabs = [{ id: 1, active: true }, { id: 2 }, { id: 3 }];
        const manager = new StateManager();

        await manager.toggleOnScreenKeyboard(1);

        expect(lastSentTo(1)?.isOnScreenKeyboardEnabled).toBe(true);
        expect(lastSentTo(2)?.isOnScreenKeyboardEnabled).toBe(true);
        expect(lastSentTo(3)?.isOnScreenKeyboardEnabled).toBe(true);
    });

    it("a tab opened later adopts the shared value", async () => {
        withSettings({ shareAcrossTabs: true });
        const manager = new StateManager();
        await manager.toggleOnScreenKeyboard(1);

        // Tab 9 wasn't open during the toggle; its derived state should still match.
        await manager.sendStateToTab(9);

        expect(lastSentTo(9)?.isOnScreenKeyboardEnabled).toBe(true);
    });

    it("does not fan out when sharing is off", async () => {
        withSettings({ shareAcrossTabs: false });
        tabs = [{ id: 1, active: true }, { id: 2 }];
        const manager = new StateManager();

        await manager.toggleOnScreenKeyboard(1);

        expect(lastSentTo(1)?.isOnScreenKeyboardEnabled).toBe(true);
        expect(lastSentTo(2)).toBeUndefined();
    });
});
