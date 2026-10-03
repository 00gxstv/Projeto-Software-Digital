import { NextResponse } from "next/server";
import { absoluteAppUrl, requestHasValidOrigin } from "../../../lib/auth";
import { createClient } from "../../../lib/supabase/server";

export async function POST(request: Request) {
  if (!requestHasValidOrigin(request)) return new Response("Origem não permitida", { status: 403 });
  const client = await createClient();
  await client.auth.signOut({ scope: "local" });
  const response = NextResponse.redirect(absoluteAppUrl(request, "/login?sessao=encerrada"), 303);
  for (const name of ["digital_mais_account", "digital_mais_session", "digital_mais_recovery_code"]) response.cookies.delete(name);
  return response;
}
