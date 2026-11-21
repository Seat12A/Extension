import { createTranslator, resolveLang } from "~/shared/i18n";
import { getSettings, onSettingsChanged, type Settings } from "~/shared/settings";
import { CACHE_EPOCH_KEY } from "~/shared/constants";
import { loadAuthorIds, resetAuthorIds } from "./author-ids";
import { createPipeline, type Pipeline } from "./pipeline";
import { BADGES_CLASS } from "./selectors";
import { detectTheme, watchTheme } from "./theme";
import { setTheme, setTranslator } from "./ui/state";

export interface App { pipeline: Pipeline; stop(): void }

let showBadges = false;

function applyLocal(settings: Settings): void {
  showBadges = settings.showBadges;
  document.documentElement.classList.toggle(BADGES_CLASS, settings.showBadges);
  setTranslator(createTranslator(resolveLang(settings.language)));
}

/**
 * X rewrites <html>'s attributes on some routes (notably logged out), which dropped our
 * class and brought X's checkmarks back. Put it back whenever it disappears.
 */
function guardBadgesClass(): () => void {
  const root = document.documentElement;
  const mo = new MutationObserver(() => {
    if (showBadges && !root.classList.contains(BADGES_CLASS)) root.classList.add(BADGES_CLASS);
  });
  mo.observe(root, { attributes: true, attributeFilter: ["class"] });
  return () => mo.disconnect();
}

/** Wires settings, theme, translator and the pipeline together. Never throws. */
export async function startApp(): Promise<App | null> {
  try {
    if (window.top !== window) return null;
    const settings = await getSettings();
    applyLocal(settings);
    setTheme(detectTheme());
    await loadAuthorIds();
    const pipeline = createPipeline(settings);
    const stopTheme = watchTheme((t) => setTheme(t));
    const stopGuard = guardBadgesClass();
    const onStorage = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area !== "local" || !changes[CACHE_EPOCH_KEY]) return;
      try {
        resetAuthorIds();
        pipeline.reset();
      } catch { /* ignore */ }
    };
    chrome.storage.onChanged.addListener(onStorage);
    const stopSettings = onSettingsChanged((s) => {
      try {
        applyLocal(s);
        pipeline.applySettings(s);
      } catch { /* ignore */ }
    });
    await pipeline.start();
    return {
      pipeline,
      stop() {
        pipeline.stop();
        stopTheme();
        stopSettings();
        stopGuard();
        chrome.storage.onChanged.removeListener(onStorage);
        document.documentElement.classList.remove(BADGES_CLASS);
      },
    };
  } catch {
    return null;
  }
}
