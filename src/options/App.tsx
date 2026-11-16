import { useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LogoMark, Wordmark } from "@/components/brand";
import { useT } from "@/i18n";
import { OPTIONS_TABS, buildHash, parseHash, type OptionsTab } from "@/lib/hash";
import { GeneralSection } from "./sections/general";
import { PrivacySection } from "./sections/privacy";
import { RequestSection } from "./sections/request";
import { ReportSection } from "./sections/report";
import { AboutSection } from "./sections/about";

export function App() {
  const { t } = useT();
  const [{ tab, params }, setNav] = useState(() => parseHash(location.hash));
  useEffect(() => {
    const on = () => setNav(parseHash(location.hash));
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  useEffect(() => { Object.assign(document, { title: t("options_document_title") }); }, [t]);

  const account = /^\d{1,20}$/.test(params.account ?? "") ? params.account! : "";
  const change = (next: string) => {
    // Keep the hash in sync with the active tab (the prefilled account id stays in memory).
    history.replaceState(null, "", buildHash(next as OptionsTab));
    setNav((n) => ({ tab: next as OptionsTab, params: n.params }));
  };

  return (
    <div className="min-h-screen bg-muted dark:bg-background">
      <main className="mx-auto flex w-full max-w-[640px] flex-col gap-6 px-4 py-10">
        <header className="flex flex-col gap-3">
          <div className="flex items-center gap-3 text-foreground">
            <LogoMark className="h-10" />
            <Wordmark className="h-6 w-auto" />
          </div>
          <p className="text-[15px] text-ink-slate">{t("brand_tagline")}</p>
        </header>

        <Tabs value={tab} onValueChange={change} className="gap-4">
          <TabsList aria-label={t("options_nav_label")} className="h-auto w-full justify-start gap-1 overflow-x-auto rounded-full border bg-card p-1">
            {OPTIONS_TABS.map((k) => (
              <TabsTrigger key={k} value={k} className="h-8 flex-none rounded-full px-3.5 text-[13px] font-semibold data-[state=active]:bg-secondary dark:data-[state=active]:bg-secondary">
                {t(`options_tab_${k}`)}
              </TabsTrigger>
            ))}
          </TabsList>

          <div className="rounded-xl border bg-card p-6">
            <TabsContent value="general"><GeneralSection /></TabsContent>
            <TabsContent value="privacy"><PrivacySection /></TabsContent>
            <TabsContent value="request"><RequestSection key={`r-${account}`} initialAccount={account} /></TabsContent>
            <TabsContent value="report"><ReportSection key={`p-${account}`} initialAccount={account} /></TabsContent>
            <TabsContent value="about"><AboutSection /></TabsContent>
          </div>
        </Tabs>
      </main>
    </div>
  );
}
