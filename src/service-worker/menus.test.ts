/**
 * @jest-environment node
 */
import { createMenus, menus } from "./menus";

let created: { id?: string }[];
let removeAllCalls: number;
let removeAllCompleted: boolean;
let createdBeforeRemoveAllCompleted: boolean;

// `runtime` controls the Firefox signal: presence of getBrowserInfo means
// "Firefox-family" (no built-in Options entry → add ours). Default mock omits
// it, modelling Chrome.
function installChromeMock(runtime: object = {}) {
    created = [];
    removeAllCalls = 0;
    removeAllCompleted = false;
    createdBeforeRemoveAllCompleted = false;

    Object.assign(globalThis, {
        chrome: {
            runtime,
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
}

beforeEach(() => installChromeMock());

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

    it("does NOT add an Options item on Chrome (no getBrowserInfo)", async () => {
        await createMenus();

        expect(created.map((c) => c.id)).not.toContain(menus.openOptions.id);
    });

    it("adds an Options item on Firefox (getBrowserInfo present)", async () => {
        installChromeMock({ getBrowserInfo: () => Promise.resolve({ name: "Firefox" }) });

        await createMenus();

        expect(created.map((c) => c.id)).toContain(menus.openOptions.id);
    });
});
