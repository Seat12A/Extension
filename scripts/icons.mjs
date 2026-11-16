// Renders the toolbar / store icons (PNG) from the brand SVG with the bundled Chromium.
// Usage: npm run icons  → writes public/icons/icon-{16,32,48,128}.png
import { chromium } from "playwright";
import { readFile, mkdir } from "node:fs/promises";

const svg = await readFile(new URL("../src/assets/brand/logo-sky.svg", import.meta.url), "utf8");
await mkdir(new URL("../public/icons/", import.meta.url), { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage();
for (const size of [16, 32, 48, 128]) {
  await page.setViewportSize({ width: size, height: size });
  // Square canvas; the logo (480x600) is centred with its aspect ratio preserved.
  await page.setContent(`<html><body style="margin:0;background:transparent;display:grid;place-items:center;width:${size}px;height:${size}px">${svg.replace("<svg ", `<svg style="height:${size}px;width:auto" `)}</body></html>`);
  await page.screenshot({ path: new URL(`../public/icons/icon-${size}.png`, import.meta.url).pathname, omitBackground: true });
}
await browser.close();
console.log("icons written");
