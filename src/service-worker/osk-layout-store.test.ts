import { getOnScreenKeyboardLayout, saveOnScreenKeyboardLayout } from "./osk-layout-store";
import { KeyboardPlacement } from "../extension-state/osk-layout";

describe("osk-layout-store", () => {
    let store: Record<string, unknown>;

    beforeEach(() => {
        store = {};
        Object.assign(globalThis, {
            chrome: {
                runtime: { onMessage: {} },
                storage: {
                    local: {
                        get: jest.fn(async (key: string) => ({ [key]: store[key] })),
                        set: jest.fn(async (obj: Record<string, unknown>) => {
                            Object.assign(store, obj);
                        }),
                    },
                },
            },
        });
    });

    const placement = (overrides: Partial<KeyboardPlacement> = {}): KeyboardPlacement => ({
        originX: "left",
        originY: "top",
        x: 1,
        y: 2,
        ...overrides,
    });

    it("remembers a position per site and defaults collapsed to false", async () => {
        await saveOnScreenKeyboardLayout({ site: "a.com", position: placement({ x: 1 }) });
        await saveOnScreenKeyboardLayout({ site: "b.com", position: placement({ originX: "right", x: 9 }) });

        // Both sites are kept (read-modify-write of the single map, not clobbered).
        expect(await getOnScreenKeyboardLayout("a.com")).toEqual({ position: placement({ x: 1 }), collapsed: false });
        expect((await getOnScreenKeyboardLayout("b.com")).position).toEqual(placement({ originX: "right", x: 9 }));
    });

    it("persists collapsed globally, independent of any site", async () => {
        await saveOnScreenKeyboardLayout({ collapsed: true });

        expect((await getOnScreenKeyboardLayout("anything.com")).collapsed).toBe(true);
        expect((await getOnScreenKeyboardLayout(undefined)).collapsed).toBe(true);
    });

    it("returns no position for an unknown or undefined site", async () => {
        await saveOnScreenKeyboardLayout({ site: "a.com", position: placement() });

        expect((await getOnScreenKeyboardLayout("none.com")).position).toBeUndefined();
        expect((await getOnScreenKeyboardLayout(undefined)).position).toBeUndefined();
    });

    it("ignores a corrupt stored placement", async () => {
        store["oskPositions"] = { "a.com": { originX: "sideways", x: 1 } };

        expect((await getOnScreenKeyboardLayout("a.com")).position).toBeUndefined();
    });
});
