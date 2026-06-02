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
        return resolveApi()[prop as keyof typeof chrome];
    },
});
