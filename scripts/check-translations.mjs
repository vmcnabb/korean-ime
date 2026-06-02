// Validates the _locales message catalogs against each other.
//
// Three rules (see scripts/translations.config.json):
//   1. Every key in the default locale (en) must exist in each `requiredLocales`
//      entry (e.g. ko) — so a "complete" translation is actually complete.
//   2. No locale may define a key that the default locale doesn't have — catches
//      typo'd keys and strings left behind after a key was renamed/removed.
//   3. Required locales must be a subset of discovered locales.

// `en_GB` is intentionally NOT a required locale: it's a sparse override (only
// the keys whose British spelling differs), and Chrome falls back to the default
// locale for the rest. Rule 1 doesn't apply to it; rule 2 still does.
//
// Locale directories are discovered from disk, so adding a new locale is picked
// up automatically by rule 2. Mark it in `requiredLocales` when it must be complete.

import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const config = readJson(resolve(root, "scripts/translations.config.json"));
const localesRoot = resolve(root, config.localesDir);

function readJson(path) {
    // Strip a leading BOM; some message files are saved with one.
    return JSON.parse(readFileSync(path, "utf8").replace(/^﻿/, ""));
}

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

if (problems.length) {
    console.error("[check-translations] FAILED:");
    for (const problem of problems) {
        console.error(`  - ${problem}`);
    }
    process.exit(1);
}

const requiredNote = requiredLocales.length ? ` (required: ${requiredLocales.join(", ")})` : "";
console.log(
    `[check-translations] OK — ${discoveredLocales.length} locales, ${defaultKeys.size} keys in ${defaultLocale}${requiredNote}`
);
