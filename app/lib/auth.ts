import { createClient } from "./supabase/server";

export const normalizeEmail = (value: string) => value.trim().toLowerCase();
export const cleanName = (value: string) => value.trim().replace(/\s+/g, " ").slice(0, 80);
export const validEmail = (value: string) => value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
export const validPassword = (value: string) => value.length >= 8 && value.length <= 128 && /[A-Za-zÀ-ÿ]/.test(value) && /\d/.test(value);

export async function getSession() {
  const client = await createClient();
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) return null;
  return { id: user.id, email: user.email ?? "", name: cleanName(String(user.user_metadata?.name ?? user.email?.split("@")[0] ?? "Equipe")) };
}
export function requestHasValidOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return request.headers.get("sec-fetch-site") !== "cross-site";
  try { return new URL(origin).origin === absoluteAppUrl(request, "/").origin; }
  catch { return false; }
}
export function absoluteAppUrl(request: Request, path: string): URL {
  const incoming = new URL(request.url);
  const host = request.headers.get("x-forwarded-host")?.split(",")[0].trim() || request.headers.get("host") || incoming.host;
  const protocol = request.headers.get("x-forwarded-proto")?.split(",")[0].trim() || incoming.protocol.replace(":", "");
  return new URL(path, protocol + "://" + host);
}
