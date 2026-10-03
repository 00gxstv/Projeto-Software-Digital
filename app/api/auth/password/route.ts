import { NextResponse } from "next/server";
import { absoluteAppUrl, requestHasValidOrigin, validPassword } from "../../../lib/auth";
import { createClient } from "../../../lib/supabase/server";

export async function POST(request: Request) {
  if (!requestHasValidOrigin(request)) return new Response("Origem não permitida", { status: 403 });
  const client = await createClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) return NextResponse.redirect(absoluteAppUrl(request, "/esqueci-senha"), 303);
  try {
    const form = await request.formData();
    const password = String(form.get("password") ?? "");
    if (!validPassword(password) || password !== form.get("passwordConfirmation")) throw new Error("Senha inválida");
    const { error } = await client.auth.updateUser({ password });
    if (error) throw error;
    await client.auth.signOut({ scope: "global" });
    return NextResponse.redirect(absoluteAppUrl(request, "/login?senha=alterada"), 303);
  } catch { return NextResponse.redirect(absoluteAppUrl(request, "/redefinir-senha?erro=senha"), 303); }
}
