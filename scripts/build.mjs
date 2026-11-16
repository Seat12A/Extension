// Builds the MV3 extension into dist/.
//   node scripts/build.mjs           production build
//   node scripts/build.mjs --watch   rebuild on change (reload the extension in chrome://extensions)
// Env (or .env / .env.local): VITE_GATE_URL, VITE_SITE_URL.
//
// Three Vite builds are needed because MV3 contexts differ:
//   - pages (popup, options): regular multi-page app (ES modules allowed)
//   - content script: single IIFE file (content scripts cannot be ES modules)
//   - service worker: single ES module file ("type": "module" in the manifest)
// Then: manifest.json (host_permissions derived from VITE_GATE_URL), _locales, fonts.
import { build, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import svgr from "vite-plugin-svgr";
import { readFile, writeFile, mkdir, readdir, rm, copyFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(fileURLToPath(import.meta.url), "../..");
const dist = path.join(root, "dist");
const watch = process.argv.includes("--watch");
const mode = watch ? "development" : "production";
const env = { ...loadEnv(mode, root, "VITE_"), ...Object.fromEntries(Object.entries(process.env).filter(([k]) => k.startsWith("VITE_"))) };
const gateUrl = (env.VITE_GATE_URL || "http://localhost:8000").replace(/\/+$/, "");
const pkg = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));

const shared = {
  configFile: false,
  mode,
  envDir: root,
  resolve: { alias: { "@": path.join(root, "src/ui"), "~": path.join(root, "src") } },
  define: { "import.meta.env.VITE_GATE_URL": JSON.stringify(gateUrl), "import.meta.env.VITE_SITE_URL": JSON.stringify(env.VITE_SITE_URL || "https://seat12a.example") },
  logLevel: "warn",
};
const w = watch ? { watch: {} } : {};

await rm(dist, { recursive: true, force: true });

// 1. Pages
await build({
  ...shared,
  root: path.join(root, "src/pages"),
  base: "./",
  publicDir: path.join(root, "public"),
  plugins: [react(), tailwindcss(), svgr()],
  build: {
    outDir: dist, emptyOutDir: false, sourcemap: watch, ...w,
    rollupOptions: { input: { popup: path.join(root, "src/pages/popup.html"), options: path.join(root, "src/pages/options.html") } },
  },
});

// 2. Content script (IIFE)
await build({
  ...shared,
  publicDir: false,
  plugins: [svgr()],
  build: {
    outDir: dist, emptyOutDir: false, sourcemap: watch ? "inline" : false, ...w,
    lib: { entry: path.join(root, "src/content/index.ts"), formats: ["iife"], name: "seat12a", fileName: () => "content.js" },
  },
});

// 3. Service worker (ES module)
await build({
  ...shared,
  publicDir: false,
  build: {
    outDir: dist, emptyOutDir: false, sourcemap: watch ? "inline" : false, ...w,
    lib: { entry: path.join(root, "src/background/index.ts"), formats: ["es"], fileName: () => "background.js" },
  },
});

// 4. Static: content.css + fonts used by in-page UI
await copyFile(path.join(root, "src/content/content.css"), path.join(dist, "content.css"));
await mkdir(path.join(dist, "fonts"), { recursive: true });
const fontDir = path.join(root, "node_modules/@fontsource-variable/google-sans/files");
for (const f of ["google-sans-latin-wght-normal.woff2", "google-sans-latin-ext-wght-normal.woff2"]) {
  await copyFile(path.join(fontDir, f), path.join(dist, "fonts", f));
}

// 5. _locales/<lang>/messages.json, merged from src/locales/<lang>/*.json
const localesDir = path.join(root, "src/locales");
for (const lang of await readdir(localesDir)) {
  const merged = {};
  for (const file of (await readdir(path.join(localesDir, lang))).filter((f) => f.endsWith(".json")).sort()) {
    const content = JSON.parse(await readFile(path.join(localesDir, lang, file), "utf8"));
    for (const [key, value] of Object.entries(content)) {
      if (key in merged) throw new Error(`Duplicate i18n key "${key}" in ${lang}/${file}`);
      // Chrome only allows $1…$9 through declared placeholders: declare them.
      const subs = [...new Set(value.message.match(/\$\d/g) ?? [])];
      const entry = { message: value.message.replace(/\$(\d)/g, "$$P$1$$"), description: value.description };
      if (subs.length) entry.placeholders = Object.fromEntries(subs.map((s) => [`p${s[1]}`, { content: s }]));
      merged[key] = entry;
    }
  }
  await mkdir(path.join(dist, "_locales", lang), { recursive: true });
  await writeFile(path.join(dist, "_locales", lang, "messages.json"), JSON.stringify(merged, null, 2));
}

// 6. manifest.json
const gateOrigin = new URL(gateUrl).origin;
const manifest = {
  manifest_version: 3,
  name: "__MSG_extName__",
  short_name: "__MSG_extShortName__",
  description: "__MSG_extDescription__",
  version: pkg.version,
  default_locale: "en",
  minimum_chrome_version: "116",
  icons: { 16: "icons/icon-16.png", 32: "icons/icon-32.png", 48: "icons/icon-48.png", 128: "icons/icon-128.png" },
  permissions: ["storage", "alarms"],
  host_permissions: ["https://x.com/*", `${gateOrigin}/*`],
  background: { service_worker: "background.js", type: "module" },
  content_scripts: [{ matches: ["https://x.com/*"], js: ["content.js"], css: ["content.css"], run_at: "document_idle" }],
  web_accessible_resources: [{ resources: ["fonts/*.woff2"], matches: ["https://x.com/*"] }],
  action: { default_popup: "popup.html", default_title: "__MSG_extName__", default_icon: { 16: "icons/icon-16.png", 32: "icons/icon-32.png" } },
  options_page: "options.html",
};
await writeFile(path.join(dist, "manifest.json"), JSON.stringify(manifest, null, 2));
console.log(`Built dist/ (gate: ${gateOrigin}, mode: ${mode})${watch ? " — watching…" : ""}`);
