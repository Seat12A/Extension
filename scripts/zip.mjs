// Packs dist/ into seat12a-extension-<version>.zip for the Chrome Web Store / Edge Add-ons.
import { execFileSync } from "node:child_process";
import { readFileSync, rmSync } from "node:fs";
const { version } = JSON.parse(readFileSync(new URL("../dist/manifest.json", import.meta.url), "utf8"));
const out = `seat12a-extension-${version}.zip`;
rmSync(out, { force: true });
execFileSync("zip", ["-qr", `../${out}`, "."], { cwd: new URL("../dist/", import.meta.url), stdio: "inherit" });
console.log(`Wrote ${out}`);
