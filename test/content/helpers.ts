import { readFileSync } from "node:fs";
import path from "node:path";

export function fixture(name: string): string {
  return readFileSync(path.resolve(__dirname, "../fixtures", name), "utf8");
}
export function load(...names: string[]): void {
  document.body.innerHTML = names.map(fixture).join("\n");
}
export function articles(): Element[] {
  return Array.from(document.querySelectorAll('article[data-testid="tweet"]'));
}
