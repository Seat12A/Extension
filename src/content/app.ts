import { createTranslator, resolveLang } from "~/shared/i18n";
import { getSettings, onSettingsChanged, type Settings } from "~/shared/settings";
import { loadAuthorIds } from "./author-ids";
import { createPipeline, type Pipeline } from "./pipeline";
import { detectTheme, watchTheme } from "./theme";
import { setTheme, setTranslator } from "./ui/state";

export interface App { pipeline: Pipeline; stop(): void }

const BADGES_CLASS = "seat12a-badges";

function applyLocal(settings: Settings): void {
  document.documentElement.classList.toggle(BADGES_CLASS, settings.showBadges);
  setTranslator(createTranslator(resolveLang(settings.language)));
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
        document.documentElement.classList.remove(BADGES_CLASS);
      },
    };
  } catch {
    return null;
  }
}
