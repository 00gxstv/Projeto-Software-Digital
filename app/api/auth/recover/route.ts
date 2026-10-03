import { NextResponse } from "next/server";
import { absoluteAppUrl, normalizeEmail, requestHasValidOrigin, validEmail } from "../../../lib/auth";
import { createClient } from "../../../lib/supabase/server";

export async function POST(request: Request) {
  if (!requestHasValidOrigin(request)) return new Response("Origem não permitida", { status: 403 });
  try {
    const form = await request.formData();
    const email = normalizeEmail(String(form.get("email") ?? ""));
    if (!validEmail(email) || form.get("website")) return NextResponse.redirect(absoluteAppUrl(request, "/esqueci-senha?erro=email"), 303);
    const client = await createClient();
    const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: absoluteAppUrl(request, "/auth/callback?next=/redefinir-senha").href });
    return NextResponse.redirect(absoluteAppUrl(request, error ? "/esqueci-senha?erro=envio" : "/esqueci-senha?enviado=1"), 303);
  } catch { return NextResponse.redirect(absoluteAppUrl(request, "/esqueci-senha?erro=envio"), 303); }
}
