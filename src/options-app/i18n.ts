/**
 * Resolve a localized message for the options page via `chrome.i18n`, mirroring
 * how the romanize popup localizes its strings. Keys live in
 * `src/_locales/<locale>/messages.json`; Chrome falls back to the default
 * locale (en) for any key a locale doesn't define.
 *
 * The `chrome?.i18n` guard keeps this usable outside the extension runtime
 * (e.g. a unit test or a plain preview), where it returns the key unchanged.
 */
export function t(key: string): string {
    return globalThis.chrome?.i18n?.getMessage(key) || key;
}
