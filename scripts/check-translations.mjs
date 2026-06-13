// Validates the _locales message catalogs against each other and the manifest.
//
// Four rules (see scripts/translations.config.json):
//   1. Every key in the default locale (en) must exist in each `requiredLocales`
//      entry (e.g. ko) — so a "complete" translation is actually complete.
//   2. No locale may define a key that the default locale doesn't have — catches
//      typo'd keys and strings left behind after a key was renamed/removed.
//   3. Required locales must be a subset of discovered locales.
//   4. Every message the manifest references as "__MSG_<key>__" (the extension
//      name, short name, and description) must be defined in EVERY locale present
//      in _locales — including sparse overrides. Chrome resolves the store-listing
//      name/description per locale and does NOT fall back to the default locale for
//      these, so a locale that omits one makes the Chrome Web Store reject the
//      upload ("The translation of the name of your item is missing in locale X").

// `en_GB` is intentionally NOT a required locale: it's a sparse override (only
// the keys whose British spelling differs), and Chrome falls back to the default
// locale for the rest. Rule 1 doesn't apply to it; rule 2 still does — and so does
// rule 4, which is why even a sparse override must carry the manifest keys.
//
// Locale directories are discovered from disk, so adding a new locale is picked up
// automatically by rules 2 and 4. Mark it in `requiredLocales` when it must be complete.

import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

// Strip a leading BOM (U+FEFF) if present, so JSON.parse doesn't choke on it.
const stripBom = (text) => (text.charCodeAt(0) === 0xfeff ? text.slice(1) : text);

function readJson(path) {
    return JSON.parse(stripBom(readFileSync(path, "utf8")));
}

const root = process.cwd();
const config = readJson(resolve(root, "scripts/translations.config.json"));
const localesRoot = resolve(root, config.localesDir);

// Keys the manifest references as "__MSG_<key>__" (extension name/short_name/
// description). Read as raw text and matched, since placeholders only occur in
// string values. These must exist in every locale (rule 4).
const manifestText = readFileSync(resolve(root, config.manifestBase), "utf8");
const manifestKeys = [...new Set([...manifestText.matchAll(/__MSG_([A-Za-z0-9_@]+)__/g)].map((match) => match[1]))];

function messageKeys(locale) {
    return Object.keys(readJson(resolve(localesRoot, locale, "messages.json")));
}

function fail(message) {
    console.error(`[check-translations] ${message}`);
    process.exit(1);
}

const discoveredLocales = readdirSync(localesRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);

const { defaultLocale, requiredLocales } = config;

if (!discoveredLocales.includes(defaultLocale)) {
    fail(`default locale "${defaultLocale}" not found in ${config.localesDir}`);
}

const defaultKeys = new Set(messageKeys(defaultLocale));
const problems = [];

// Rule 3: required locales must be a subset of discovered locales.
for (const required of requiredLocales) {
    if (!discoveredLocales.includes(required)) {
        problems.push(`required locale "${required}" not found in ${config.localesDir}`);
    }
}

for (const locale of discoveredLocales) {
    if (locale === defaultLocale) {
        continue;
    }

    const keys = messageKeys(locale);
    const keySet = new Set(keys);

    // Rule 2 (all locales): no keys the default locale doesn't define.
    const extra = keys.filter((key) => !defaultKeys.has(key));
    if (extra.length) {
        problems.push(`${locale}: has keys not in ${defaultLocale}: ${extra.join(", ")}`);
    }

    // Rule 1 (required locales only): must define every default-locale key.
    if (requiredLocales.includes(locale)) {
        const missing = [...defaultKeys].filter((key) => !keySet.has(key));
        if (missing.length) {
            problems.push(`${locale}: missing translations for: ${missing.join(", ")}`);
        }
    }
}

// Rule 4 (all locales, incl. the default and sparse overrides like en_GB/pt_PT):
// every manifest-referenced key must be present, or the Chrome Web Store rejects
// the upload (Chrome doesn't fall back to the default locale for these).
for (const locale of discoveredLocales) {
    const keySet = new Set(messageKeys(locale));
    const missing = manifestKeys.filter((key) => !keySet.has(key));
    if (missing.length) {
        problems.push(`${locale}: missing manifest-referenced keys: ${missing.join(", ")}`);
    }
}

if (problems.length) {
    console.error("[check-translations] FAILED:");
    for (const problem of problems) {
        console.error(`  - ${problem}`);
    }
    process.exit(1);
}

const requiredNote = requiredLocales.length ? ` (required: ${requiredLocales.join(", ")})` : "";
console.log(
    `[check-translations] OK — ${discoveredLocales.length} locales, ${defaultKeys.size} keys in ${defaultLocale}, ${manifestKeys.length} manifest keys${requiredNote}`
);
