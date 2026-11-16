import "@/globals.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { I18nProvider } from "@/i18n";
import { ThemeProvider, applyStoredTheme } from "@/theme";
import { TooltipProvider } from "@/components/ui/tooltip";
import { App } from "./App";

void applyStoredTheme().then(() => {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <I18nProvider>
        <ThemeProvider>
          <TooltipProvider>
            <App />
          </TooltipProvider>
        </ThemeProvider>
      </I18nProvider>
    </StrictMode>,
  );
});
