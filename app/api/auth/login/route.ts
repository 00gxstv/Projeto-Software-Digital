import { NextResponse } from "next/server";
import {
  ACCOUNT_COOKIE,
  SESSION_COOKIE,
  absoluteAppUrl,
  cookieFromRequest,
  createSessionToken,
  normalizeEmail,
  passwordMatches,
  readAccountToken,
  requestHasValidOrigin,
  sessionCookieOptions,
} from "../../../lib/auth";

function loginError(request: Request, email: string) {
  const url = absoluteAppUrl(request, "/login");
  url.searchParams.set("erro", "credenciais");
  if (email) url.searchParams.set("email", email);
  return NextResponse.redirect(url, 303);
}

export async function POST(request: Request) {
  if (!requestHasValidOrigin(request)) {
    return new Response("Origem da requisição não permitida.", { status: 403 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return loginError(request, "");
  }

  const email = normalizeEmail(String(formData.get("email") ?? ""));
  const password = String(formData.get("password") ?? "");
  const account = await readAccountToken(cookieFromRequest(request, ACCOUNT_COOKIE));

  if (!account || account.email !== email || !(await passwordMatches(account, password))) {
    return loginError(request, email);
  }

  const sessionToken = await createSessionToken(account.name, account.email);
  const response = NextResponse.redirect(absoluteAppUrl(request, "/sistema"), 303);
  response.cookies.set(SESSION_COOKIE, sessionToken, sessionCookieOptions());
  return response;
}
