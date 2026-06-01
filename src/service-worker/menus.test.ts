/**
 * @jest-environment node
 */
import { createMenus, menus } from "./menus";

// createMenus reaches romanize-menu-actions → a `url:` HTML asset import that
// Parcel resolves at build time; stub it for the test.
jest.mock("url:./popup-converter/popup-converter.html", () => "popup.html", { virtual: true });

let created: { id?: string }[];
let removeAllCalls: number;
let removeAllResolvedBeforeCreate: boolean;

beforeEach(() => {
    created = [];
    removeAllCalls = 0;
    removeAllResolvedBeforeCreate = false;

    Object.assign(globalThis, {
        chrome: {
            contextMenus: {
                removeAll: jest.fn(async () => {
                    removeAllCalls++;
                    created = []; // model real chrome: clears all existing items
                }),
                create: jest.fn((options: { id?: string }) => {
                    // Records whether removeAll has been awaited by the time any
                    // item is created — i.e. the clear happens first.
                    if (created.length === 0) {
                        removeAllResolvedBeforeCreate = removeAllCalls > 0;
                    }
                    created.push(options);
                }),
            },
            i18n: { getMessage: (key: string) => key },
        },
    });
});

describe("createMenus", () => {
    it("clears existing menus before creating, so repeated calls don't collide", async () => {
        await createMenus();

        expect(removeAllCalls).toBe(1);
        expect(removeAllResolvedBeforeCreate).toBe(true);
    });

    it("creates the three expected menu items", async () => {
        await createMenus();

        expect(created.map((c) => c.id)).toEqual([
            menus.romanizeInPopup.id,
            menus.romanizeBeside.id,
            menus.onScreenKeyboard.id,
        ]);
    });

    it("is safe to call repeatedly (idempotent)", async () => {
        await createMenus();
        await createMenus();

        // Each run clears first, so after two runs there are exactly three items, not six.
        expect(removeAllCalls).toBe(2);
        expect(created).toHaveLength(3);
    });
});
