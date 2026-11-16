/**
 * Build-time configuration. Values come from Vite env variables (see `.env.example`).
 * The gate origin is also written into `host_permissions` by `scripts/build.mjs`,
 * so both always match.
 */
export const GATE_URL: string = (import.meta.env.VITE_GATE_URL ?? "https://api.seat12a.org").replace(/\/+$/, "");
/** Public website (privacy policy, badge request form, cases). */
export const SITE_URL: string = (import.meta.env.VITE_SITE_URL ?? "https://seat12a.org").replace(/\/+$/, "");
export const PRIVACY_URL = `${SITE_URL}/privacy`;
