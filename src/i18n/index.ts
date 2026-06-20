import type { MessageKey } from "./message-key";

export type { MessageKey };

/**
 * Resolve a localized message for the options page via `chrome.i18n`, mirroring
 * how the romanize popup localizes its strings. Keys live in
 * `src/_locales/<locale>/messages.json`; Chrome falls back to the default
 * locale (en) for any key a locale doesn't define.
 *
 * Outside the extension runtime (a unit test or a plain preview) `chrome.i18n`
 * is absent, so the key is returned unchanged. We only fall back when i18n is
 * unavailable — not when the resolved message is falsy — because an empty
 * string can be an intentional translation (e.g. a hint omitted in some
 * locales); `|| key` would wrongly render the key name in that case.
 */
export function t(key: MessageKey, substitutions?: string | (string | number)[] | undefined): string {
    const i18n = globalThis.chrome?.i18n;
    return i18n ? i18n.getMessage(key, substitutions) : key;
}
