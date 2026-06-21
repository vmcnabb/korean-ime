#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_LIBHANGUL_DIR = path.resolve(repoRoot, "../libhangul");
const OUTPUT_DIR = path.join(repoRoot, "src/hanja-dictionary");
const OUTPUT_FILE = path.join(OUTPUT_DIR, "single-syllable.data");

const args = parseArgs(process.argv.slice(2));
const libhangulDir = path.resolve(args.libhangulDir ?? process.env.LIBHANGUL_DIR ?? DEFAULT_LIBHANGUL_DIR);
const hanjaFile = path.join(libhangulDir, "data/hanja/hanja.txt");

const source = await readFile(hanjaFile, "utf8");
const dictionary = buildSingleSyllableDictionary(source);

await mkdir(OUTPUT_DIR, { recursive: true });
await writeFile(OUTPUT_FILE, `${JSON.stringify(dictionary)}\n`, "utf8");

const readingCount = Object.keys(dictionary).length;
const candidateCount = Object.values(dictionary).reduce((total, candidates) => total + candidates.length, 0);
console.log(`[gen-hanja] wrote ${path.relative(repoRoot, OUTPUT_FILE)}`);
console.log(`[gen-hanja] ${readingCount} single-syllable readings, ${candidateCount} candidates`);
console.log(`[gen-hanja] source ${path.relative(repoRoot, hanjaFile)}`);

function parseArgs(argv) {
    const parsed = {};

    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index];
        if (arg === "--libhangul-dir") {
            parsed.libhangulDir = argv[index + 1];
            index += 1;
        } else if (arg.startsWith("--libhangul-dir=")) {
            parsed.libhangulDir = arg.slice("--libhangul-dir=".length);
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
