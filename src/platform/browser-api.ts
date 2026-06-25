/**
 * Neutral handle for the extension (WebExtension) API.
 *
 * Chrome exposes only `chrome.*`; Firefox exposes promise-based `browser.*`
 * (and a `chrome.*` compat alias). Both namespaces are shape-identical and
 * promise-based for the surface this extension uses, so call sites import `api`
 * instead of naming a concrete global. This localizes the platform dependency
 * to one module — groundwork for a future Firefox build.
 *
 * Selection is runtime (prefer `browser` when present). It's a Proxy rather than
 * a captured reference so lookup is lazy per-access: unit tests install their
 * `chrome` mock after this module is imported, and a Proxy picks it up where a
 * module-load-time capture would freeze `undefined`.
 *
 * Typed as `typeof chrome` (from @types/chrome) — accurate for the common,
 * identically-shaped subset we use. `browser` satisfies the same shape.
 */
const resolveApi = (): typeof chrome => {
    const candidate = (globalThis as { browser?: typeof chrome }).browser ?? globalThis.chrome;
    if (!candidate) {
        throw new Error("No WebExtension API (browser/chrome) available");
    }
    return candidate;
};

export const api: typeof chrome = new Proxy({} as typeof chrome, {
    get(_target, prop) {
        const target = resolveApi();
        // MV2 (used for the Firefox dev build) exposes `browserAction` instead of
        // the MV3 `action` API. Both share the surface we use (onClicked, setIcon,
        // setTitle), so normalize to `api.action` for every context. Production is
        // MV3 everywhere, where `action` is present and this fallback is unused.
        if (prop === "action") {
            return target.action ?? (target as unknown as { browserAction?: typeof chrome.action }).browserAction;
        }
        return target[prop as keyof typeof chrome];
    },
});
