/**
 * @jest-environment node
 */
import { createMenus, menus } from "./menus";

// createMenus reaches romanize-menu-actions → a `url:` HTML asset import that
// Parcel resolves at build time; stub it for the test.
jest.mock("url:./popup-converter/popup-converter.html", () => "popup.html", { virtual: true });

let created: { id?: string }[];
let removeAllCalls: number;
let removeAllCompleted: boolean;
let createdBeforeRemoveAllCompleted: boolean;

beforeEach(() => {
    created = [];
    removeAllCalls = 0;
    removeAllCompleted = false;
    createdBeforeRemoveAllCompleted = false;

    Object.assign(globalThis, {
        chrome: {
            contextMenus: {
                removeAll: jest.fn(async () => {
                    removeAllCalls++;
                    // Real async boundary: `completed` flips only after a
                    // microtask, so the ordering assertions below pass only if
                    // createMenus actually awaits removeAll rather than firing
                    // it and proceeding straight to create.
                    await Promise.resolve();
                    removeAllCompleted = true;
                    created = []; // model real chrome: clears all existing items
                }),
                create: jest.fn((options: { id?: string }) => {
                    if (!removeAllCompleted) {
                        createdBeforeRemoveAllCompleted = true;
                    }
                    created.push(options);
                }),
            },
            i18n: { getMessage: (key: string) => key },
        },
    });
});

describe("createMenus", () => {
    it("awaits removeAll before creating, so repeated calls don't collide", async () => {
        await createMenus();

        expect(removeAllCalls).toBe(1);
        expect(createdBeforeRemoveAllCompleted).toBe(false);
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
