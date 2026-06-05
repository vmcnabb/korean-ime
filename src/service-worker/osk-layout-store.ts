import { KeyboardPlacement, OnScreenKeyboardLayout } from "../extension-state/osk-layout";
import { api } from "../platform/browser-api";

/**
 * Service-worker-owned persistence for the on-screen-keyboard layout, in
 * `chrome.storage.local` (per-device — a pixel position is only meaningful on
 * the screen it was set on). Positions are a single map keyed by site; the
 * collapsed state is one global value.
 *
 * Only the service worker reads/writes these, so the read-modify-write of the
 * positions map is single-context and concurrent tabs can't clobber each other.
 */
const POSITIONS_KEY = "oskPositions";
const COLLAPSED_KEY = "oskCollapsed";

type PositionsMap = Record<string, KeyboardPlacement>;

function isPlacement(value: unknown): value is KeyboardPlacement {
    if (typeof value !== "object" || value === null) {
        return false;
    }
    const p = value as Record<string, unknown>;
    return (
        (p.originX === "left" || p.originX === "right") &&
        (p.originY === "top" || p.originY === "bottom") &&
        typeof p.x === "number" &&
        typeof p.y === "number"
    );
}

async function getPositions(): Promise<PositionsMap> {
    const stored = (await api.storage.local.get(POSITIONS_KEY))[POSITIONS_KEY];
    if (typeof stored !== "object" || stored === null) {
        return {};
    }
    // Keep only well-formed entries, so a corrupt/partial stored value can't
    // surface a malformed placement to the keyboard.
    const result: PositionsMap = {};
    for (const [site, placement] of Object.entries(stored as Record<string, unknown>)) {
        if (isPlacement(placement)) {
            result[site] = placement;
        }
    }
    return result;
}

/** The layout to restore for a site: its saved position (if any) + the global collapsed state. */
export async function getOnScreenKeyboardLayout(site?: string): Promise<OnScreenKeyboardLayout> {
    const collapsed = (await api.storage.local.get(COLLAPSED_KEY))[COLLAPSED_KEY] === true;
    const position = site ? (await getPositions())[site] : undefined;
    return { position, collapsed };
}

/** Persist whichever fields are present: the per-site position and/or the global collapsed state. */
export async function saveOnScreenKeyboardLayout(update: {
    site?: string;
    position?: KeyboardPlacement;
    collapsed?: boolean;
}): Promise<void> {
    if (update.position && update.site) {
        const positions = await getPositions();
        positions[update.site] = update.position;
        await api.storage.local.set({ [POSITIONS_KEY]: positions });
    }

    if (update.collapsed !== undefined) {
        await api.storage.local.set({ [COLLAPSED_KEY]: update.collapsed });
    }
}
