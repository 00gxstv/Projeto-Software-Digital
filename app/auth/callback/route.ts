import { NextResponse } from "next/server";
import { createClient } from "../../lib/supabase/server";
import { absoluteAppUrl } from "../../lib/auth";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  if (code) {
    const client = await createClient();
    const { error } = await client.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(absoluteAppUrl(request, url.searchParams.get("next") === "/redefinir-senha" ? "/redefinir-senha" : "/sistema"));
  }
  return NextResponse.redirect(absoluteAppUrl(request, "/login?erro=link"));
}
