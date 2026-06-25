// Parcel auto-polyfilled Node's `process` for the browser; Vite does not, so a
// runtime `process.env.X` read throws "process is undefined". Vite statically
// replaces `process.env.NODE_ENV` (dev + build) and custom build flags at build
// time (see wxt.config.ts `define`), but in the *dev* server custom keys like
// `process.env.KIME_ENABLE_HANJA` are left as runtime reads. This shim makes
// those reads return `undefined` instead of crashing — flags default off, which
// is the dev default. It is a no-op under Node (jest) and in production builds
// where the references are already folded to constants. Import this first.
const globalWithProcess = globalThis as unknown as { process?: { env: Record<string, string | undefined> } };
globalWithProcess.process ??= { env: {} };
