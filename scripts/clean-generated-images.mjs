import { existsSync, readdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";

const generatedAssetDirs = [resolve(process.cwd(), "src/images"), resolve(process.cwd(), "src/videos")];

for (const dir of generatedAssetDirs) {
    if (!existsSync(dir)) {
        continue;
    }

    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        rmSync(resolve(dir, entry.name), { recursive: true, force: true });
    }
}
