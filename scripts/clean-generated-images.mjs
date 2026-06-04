import { existsSync, readdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";

const outputImageDir = resolve(process.cwd(), "src/images");

if (!existsSync(outputImageDir)) {
    process.exit(0);
}

for (const entry of readdirSync(outputImageDir, { withFileTypes: true })) {
    rmSync(resolve(outputImageDir, entry.name), { recursive: true, force: true });
}
