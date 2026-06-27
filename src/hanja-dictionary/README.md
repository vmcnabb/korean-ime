# Hanja Dictionary Data

This directory contains generated runtime data for the feature-flagged Hanja IME.

## Scope

The generated data contains:

- single- and multi-character Hangul readings
- ordered Hanja candidates for each reading
- Korean reading/gloss text from libhangul
- Simplified Chinese variants from Unihan for single-character candidates, when listed
- Pinyin from Unihan `kMandarin` for single-character candidates, when listed

The generated `.data` files contain JSON. The neutral extension is
intentional: it lets the extension fetch the file at runtime as a packaged asset
(imported with Vite's `?url` suffix) instead of being compiled into a JavaScript
JSON module.

It does not include frequency ranking data.

## Source

Generated from libhangul and Unihan:

- upstream repository: <https://github.com/libhangul/libhangul>
- libhangul source file: `data/hanja/hanja.txt`
- libhangul source commit used: `a34aef7`
- Unihan source files: `Unihan_Variants.txt` and `Unihan_Readings.txt`
- Unihan version used: Unicode 17.0.0, dated 2025-07-24

The generator expects the usual sibling checkout layout by default:

```text
~/code/
  korean-ime/
  libhangul/
  Unihan/
```

From this repository root, that means the default source paths are:

```text
../libhangul/data/hanja/hanja.txt
../Unihan/Unihan_Variants.txt
../Unihan/Unihan_Readings.txt
```

Use `LIBHANGUL_DIR` / `--libhangul-dir` and `UNIHAN_DIR` / `--unihan-dir` when
the source checkouts live somewhere else.

## Regeneration

```bash
npm run gen-hanja
```

or:

```bash
npm run gen-hanja -- --libhangul-dir /path/to/libhangul
```

or:

```bash
npm run gen-hanja -- --libhangul-dir /path/to/libhangul --unihan-dir /path/to/Unihan
```

## License And Attribution

The generated dictionary is derived from libhangul `hanja.txt` and the Unicode
Unihan database.

The Unihan source files are part of the Unicode Character Database. Their header
points to the Unicode terms of use:

```text
Unicode Character Database
© 2025 Unicode®, Inc.
Unicode and the Unicode Logo are registered trademarks of Unicode, Inc. in the U.S. and other countries.
For terms of use and license, see https://www.unicode.org/terms_of_use.html
```

The libhangul `hanja.txt` header contains the following notice and BSD-style
license terms:

```text
Copyright (c) 2005,2006 Choe Hwanjin
All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice,
   this list of conditions and the following disclaimer.
2. Redistributions in binary form must reproduce the above copyright notice,
   this list of conditions and the following disclaimer in the documentation
   and/or other materials provided with the distribution.
3. Neither the name of the author nor the names of its contributors
   may be used to endorse or promote products derived from this software
   without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE
LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
POSSIBILITY OF SUCH DAMAGE.
```
