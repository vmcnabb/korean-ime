#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_LIBHANGUL_DIR = path.resolve(repoRoot, "../libhangul");
const DEFAULT_UNIHAN_DIR = path.resolve(repoRoot, "../Unihan");
const OUTPUT_DIR = path.join(repoRoot, "src/hanja-dictionary");
const SINGLE_SYLLABLE_OUTPUT_FILE = path.join(OUTPUT_DIR, "single-syllable.data");
const HANJA_HANZI_OUTPUT_FILE = path.join(OUTPUT_DIR, "hanja-hanzi.data");

const args = parseArgs(process.argv.slice(2));
const libhangulDir = path.resolve(args.libhangulDir ?? process.env.LIBHANGUL_DIR ?? DEFAULT_LIBHANGUL_DIR);
const unihanDir = path.resolve(args.unihanDir ?? process.env.UNIHAN_DIR ?? DEFAULT_UNIHAN_DIR);
const hanjaFile = path.join(libhangulDir, "data/hanja/hanja.txt");
const unihanVariantsFile = path.join(unihanDir, "Unihan_Variants.txt");
const unihanReadingsFile = path.join(unihanDir, "Unihan_Readings.txt");

const source = await readFile(hanjaFile, "utf8");
const dictionary = buildSingleSyllableDictionary(source);
const hanjaCharacters = new Set(Object.values(dictionary).flatMap((candidates) => candidates.map(([hanja]) => hanja)));
const hanziMetadata = buildHanziMetadata(
    hanjaCharacters,
    await readFile(unihanVariantsFile, "utf8"),
    await readFile(unihanReadingsFile, "utf8")
);

await mkdir(OUTPUT_DIR, { recursive: true });
await writeFile(SINGLE_SYLLABLE_OUTPUT_FILE, `${JSON.stringify(dictionary)}\n`, "utf8");
await writeFile(HANJA_HANZI_OUTPUT_FILE, `${JSON.stringify(hanziMetadata)}\n`, "utf8");

const readingCount = Object.keys(dictionary).length;
const candidateCount = Object.values(dictionary).reduce((total, candidates) => total + candidates.length, 0);
const metadataCount = Object.keys(hanziMetadata).length;
console.log(`[gen-hanja] wrote ${path.relative(repoRoot, SINGLE_SYLLABLE_OUTPUT_FILE)}`);
console.log(`[gen-hanja] wrote ${path.relative(repoRoot, HANJA_HANZI_OUTPUT_FILE)}`);
console.log(`[gen-hanja] ${readingCount} single-syllable readings, ${candidateCount} candidates`);
console.log(`[gen-hanja] ${metadataCount} Hanja/Hanzi metadata rows`);
console.log(`[gen-hanja] source ${path.relative(repoRoot, hanjaFile)}`);
console.log(`[gen-hanja] source ${path.relative(repoRoot, unihanVariantsFile)}`);
console.log(`[gen-hanja] source ${path.relative(repoRoot, unihanReadingsFile)}`);

function parseArgs(argv) {
    const parsed = {};

    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index];
        if (arg === "--libhangul-dir") {
            parsed.libhangulDir = argv[index + 1];
            index += 1;
        } else if (arg.startsWith("--libhangul-dir=")) {
            parsed.libhangulDir = arg.slice("--libhangul-dir=".length);
        } else if (arg === "--unihan-dir") {
            parsed.unihanDir = argv[index + 1];
            index += 1;
        } else if (arg.startsWith("--unihan-dir=")) {
            parsed.unihanDir = arg.slice("--unihan-dir=".length);
        } else {
            throw new Error(`Unknown argument: ${arg}`);
        }
    }

    return parsed;
}

function buildSingleSyllableDictionary(sourceText) {
    const dictionary = {};

    for (const line of sourceText.split(/\r?\n/)) {
        if (!line || line.startsWith("#")) {
            continue;
        }

        const [reading, hanja, ...glossParts] = line.split(":");
        if (!isSingleHangulSyllable(reading)) {
            continue;
        }

        dictionary[reading] ??= [];
        dictionary[reading].push([hanja, glossParts.join(":")]);
    }

    return dictionary;
}

function buildHanziMetadata(hanjaCharacters, variantsText, readingsText) {
    const metadata = {};

    for (const line of variantsText.split(/\r?\n/)) {
        const record = parseUnihanLine(line);
        if (!record || record.field !== "kSimplifiedVariant") {
            continue;
        }

        const hanja = codePointTokenToCharacter(record.codePoint);
        if (!hanjaCharacters.has(hanja)) {
            continue;
        }

        const simplified = parseVariantCharacters(record.value).join(" ");
        if (!simplified || simplified === hanja) {
            continue;
        }

        metadata[hanja] ??= {};
        metadata[hanja].s = simplified;
    }

    for (const line of readingsText.split(/\r?\n/)) {
        const record = parseUnihanLine(line);
        if (!record || record.field !== "kMandarin") {
            continue;
        }

        const hanja = codePointTokenToCharacter(record.codePoint);
        if (!hanjaCharacters.has(hanja)) {
            continue;
        }

        metadata[hanja] ??= {};
        metadata[hanja].p = record.value;
    }

    return metadata;
}

function parseUnihanLine(line) {
    if (!line || line.startsWith("#")) {
        return undefined;
    }

    const [codePoint, field, value] = line.split("\t");
    if (!codePoint || !field || !value) {
        return undefined;
    }

    return { codePoint, field, value };
}

function parseVariantCharacters(value) {
    return value.split(/\s+/).map(codePointTokenToCharacter);
}

function codePointTokenToCharacter(token) {
    const codePoint = Number.parseInt(token.replace(/^U\+/, "").replace(/<.*$/, ""), 16);
    return String.fromCodePoint(codePoint);
}

function isSingleHangulSyllable(text) {
    if ([...text].length !== 1) {
        return false;
    }

    const codePoint = text.codePointAt(0);
    if (codePoint === undefined) {
        return false;
    }

    return codePoint >= 0xac00 && codePoint <= 0xd7a3;
}
