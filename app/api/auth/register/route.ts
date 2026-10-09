import { NextResponse } from "next/server";
import { absoluteAppUrl, cleanName, normalizeEmail, requestHasValidOrigin, validEmail, validPassword } from "../../../lib/auth";
import { createClient } from "../../../lib/supabase/server";

export async function POST(request: Request) {
  if (!requestHasValidOrigin(request)) return new Response("Origem não permitida", { status: 403 });
  const fail = (code: string) => NextResponse.redirect(absoluteAppUrl(request, "/cadastro?erro=" + code), 303);
  try {
    const form = await request.formData();
    const name = cleanName(String(form.get("name") ?? ""));
    const email = normalizeEmail(String(form.get("email") ?? ""));
    const password = String(form.get("password") ?? "");
    if (form.get("website")) return fail("dados-invalidos");
    if (name.length < 2) return fail("nome");
    if (!validEmail(email)) return fail("email");
    if (!validPassword(password)) return fail("senha");
    if (password !== form.get("passwordConfirmation")) return fail("confirmacao");
    const client = await createClient();
    const { data, error } = await client.auth.signUp({ email, password, options: { data: { name }, emailRedirectTo: absoluteAppUrl(request, "/auth/callback").href } });
    if (error) return fail(error.status === 429 ? "limite" : "cadastro");
    if (data.session) await client.auth.signOut();
    return NextResponse.redirect(absoluteAppUrl(request, "/login?cadastro=sucesso"), 303);
  } catch { return fail("conexao"); }
}
