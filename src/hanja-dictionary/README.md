# Hanja Dictionary Data

This directory contains generated runtime data for the feature-flagged Hanja IME.

## Scope

The current generated data is intentionally limited to individual Hangul syllable
conversion. It contains:

- single-syllable Hangul readings only
- ordered Hanja candidates for each reading
- Korean reading/gloss text from libhangul

The generated `single-syllable.data` file contains JSON. The neutral extension is
intentional: it lets the extension fetch the file at runtime as a packaged asset
without Parcel compiling it into a JavaScript JSON module.

It does not include multi-syllable word keys, frequency ranking data, Simplified
Chinese, or Pinyin.

## Source

Generated from libhangul:

- upstream repository: <https://github.com/libhangul/libhangul>
- source file: `data/hanja/hanja.txt`
- source commit used: `a34aef7`

The generator expects the usual sibling checkout layout by default:

```text
~/code/
  korean-ime/
  libhangul/
```

From this repository root, that means the default source path is:

```text
../libhangul/data/hanja/hanja.txt
```

Use `LIBHANGUL_DIR` or `--libhangul-dir` when the libhangul checkout lives
somewhere else.

## Regeneration

```bash
npm run gen-hanja
```

or:

```bash
npm run gen-hanja -- --libhangul-dir /path/to/libhangul
```

## License And Attribution

The generated dictionary is derived from libhangul `hanja.txt`, whose header
contains the following notice and BSD-style license terms:

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
