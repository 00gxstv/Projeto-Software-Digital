import { NextResponse } from "next/server";
import {
  ACCOUNT_COOKIE,
  SESSION_COOKIE,
  absoluteAppUrl,
  accountCookieOptions,
  cleanName,
  createAccountToken,
  normalizeEmail,
  requestHasValidOrigin,
  validEmail,
  validPassword,
} from "../../../lib/auth";

function redirectWithError(request: Request, code: string) {
  return NextResponse.redirect(absoluteAppUrl(request, `/cadastro?erro=${code}`), 303);
}

export async function POST(request: Request) {
  if (!requestHasValidOrigin(request)) {
    return new Response("Origem da requisição não permitida.", { status: 403 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return redirectWithError(request, "dados-invalidos");
  }

  const name = cleanName(String(formData.get("name") ?? ""));
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  const password = String(formData.get("password") ?? "");
  const passwordConfirmation = String(formData.get("passwordConfirmation") ?? "");
  const website = String(formData.get("website") ?? "");

  if (website) return redirectWithError(request, "dados-invalidos");
  if (name.length < 2) return redirectWithError(request, "nome");
  if (!validEmail(email)) return redirectWithError(request, "email");
  if (!validPassword(password)) return redirectWithError(request, "senha");
  if (password !== passwordConfirmation) return redirectWithError(request, "confirmacao");

  const accountToken = await createAccountToken(name, email, password);
  const loginUrl = absoluteAppUrl(request, "/login");
  loginUrl.searchParams.set("cadastro", "sucesso");
  loginUrl.searchParams.set("email", email);

  const response = NextResponse.redirect(loginUrl, 303);
  response.cookies.set(ACCOUNT_COOKIE, accountToken, accountCookieOptions());
  response.cookies.delete(SESSION_COOKIE);
  return response;
}
