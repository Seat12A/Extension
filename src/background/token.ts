import { LIMITS } from "~/shared/constants";
import { getLocal, setLocal } from "./store";

const KEY = "installToken";

export function generateToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(LIMITS.tokenBytes));
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function getToken(): Promise<string> {
  const t = await getLocal<string | null>(KEY, null);
  if (t) return t;
  return resetToken();
}

export async function resetToken(): Promise<string> {
  const t = generateToken();
  await setLocal(KEY, t);
  return t;
}
