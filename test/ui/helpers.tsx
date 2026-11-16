import { act, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { I18nProvider } from "@/i18n";
import { ThemeProvider } from "@/theme";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
(globalThis as any).ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
Element.prototype.scrollIntoView ??= () => {};
Element.prototype.hasPointerCapture ??= () => false;

export interface Mounted { container: HTMLElement; root: Root; unmount: () => void }

export async function mount(el: ReactElement, opts: { providers?: boolean } = {}): Promise<Mounted> {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(opts.providers === false ? el : <I18nProvider initial="fr"><ThemeProvider>{el}</ThemeProvider></I18nProvider>);
  });
  await flush();
  return { container, root, unmount: () => { act(() => root.unmount()); container.remove(); } };
}

export async function flush() {
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
}

/** Sets a React-controlled input/textarea value and fires the events React listens to. */
export async function type(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")!.set!;
  await act(async () => {
    setter.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

export async function submit(form: HTMLFormElement) {
  await act(async () => { form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); });
  await flush();
}
