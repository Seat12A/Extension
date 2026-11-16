/** Translator context: follows settings.language live and keeps <html lang> in sync. */
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { createTranslator, type Translator } from "~/shared/i18n";
import { getSettings, onSettingsChanged, type LanguagePref } from "~/shared/settings";

const I18nContext = createContext<Translator | null>(null);

export function I18nProvider({ children, initial = "auto" }: { children: ReactNode; initial?: LanguagePref }) {
  const [pref, setPref] = useState<LanguagePref>(initial);
  useEffect(() => {
    let alive = true;
    void getSettings().then((s) => alive && setPref(s.language));
    const off = onSettingsChanged((s) => setPref(s.language));
    return () => { alive = false; off(); };
  }, []);
  const tr = useMemo(() => createTranslator(pref), [pref]);
  useEffect(() => { document.documentElement.lang = tr.lang; }, [tr.lang]);
  return <I18nContext.Provider value={tr}>{children}</I18nContext.Provider>;
}

/** Returns the translator (destructure `t`, `tp`, `enumLabel`, …). */
export function useT(): Translator {
  const tr = useContext(I18nContext);
  if (!tr) throw new Error("useT outside I18nProvider");
  return tr;
}
