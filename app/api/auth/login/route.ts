import { NextResponse } from "next/server";
import { absoluteAppUrl, normalizeEmail, requestHasValidOrigin } from "../../../lib/auth";
import { createClient } from "../../../lib/supabase/server";

export async function POST(request: Request) {
  if (!requestHasValidOrigin(request)) return new Response("Origem não permitida", { status: 403 });
  try {
    const form = await request.formData();
    const client = await createClient();
    const { error } = await client.auth.signInWithPassword({ email: normalizeEmail(String(form.get("email") ?? "")), password: String(form.get("password") ?? "") });
    const path = error ? "/login?erro=" + (error.code === "email_not_confirmed" ? "confirmar" : "credenciais") : "/sistema";
    return NextResponse.redirect(absoluteAppUrl(request, path), 303);
  } catch { return NextResponse.redirect(absoluteAppUrl(request, "/login?erro=conexao"), 303); }
}
