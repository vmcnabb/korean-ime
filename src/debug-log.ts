// A console.debug that becomes a no-op in production. NODE_ENV is inlined by
// Parcel and the ternary folds, so in a production build `debugLog` compiles to
// `() => {}` and logs nothing — the same gating the @trace decorator relies on.
// Note: the call sites and their string arguments still remain in the bundle
// (Parcel doesn't strip cross-module no-op calls) — they just don't output
// anything. Use this for diagnostic logging; keep console.error for real errors.
export const debugLog: (...args: unknown[]) => void =
    process.env.NODE_ENV === "production" ? () => {} : (...args) => console.debug(...args);
