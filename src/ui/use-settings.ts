import { useCallback, useEffect, useState } from "react";
import { getSettings, onSettingsChanged, updateSettings, type Settings } from "~/shared/settings";

/** Live settings: `null` until loaded (render nothing / a skeleton meanwhile). */
export function useSettings(): [Settings | null, (patch: Partial<Settings>) => Promise<void>] {
  const [settings, setSettings] = useState<Settings | null>(null);
  useEffect(() => {
    let alive = true;
    void getSettings().then((s) => alive && setSettings((cur) => cur ?? s));
    const off = onSettingsChanged((s) => setSettings(s));
    return () => { alive = false; off(); };
  }, []);
  const update = useCallback(async (patch: Partial<Settings>) => {
    setSettings((cur) => (cur ? { ...cur, ...patch } : cur));
    await updateSettings(patch);
  }, []);
  return [settings, update];
}
