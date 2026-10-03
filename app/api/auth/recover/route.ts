import { NextResponse } from "next/server";
import {
  ACCOUNT_COOKIE,
  RECOVERY_CODE_COOKIE,
  SESSION_COOKIE,
  absoluteAppUrl,
  accountCookieOptions,
  cookieFromRequest,
  normalizeEmail,
  readAccountToken,
  recoveryCodeCookieOptions,
  recoveryCodeMatches,
  requestHasValidOrigin,
  resetAccountPassword,
  validEmail,
  validPassword,
} from "../../../lib/auth";

function redirectWithError(request: Request, code: string, email = "") {
  const url = absoluteAppUrl(request, "/esqueci-senha");
  url.searchParams.set("erro", code);
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
    return redirectWithError(request, "dados-invalidos");
  }

  const email = normalizeEmail(String(formData.get("email") ?? ""));
  const recoveryCode = String(formData.get("recoveryCode") ?? "");
  const password = String(formData.get("password") ?? "");
  const passwordConfirmation = String(formData.get("passwordConfirmation") ?? "");
  const website = String(formData.get("website") ?? "");

  if (website) return redirectWithError(request, "dados-invalidos", email);
  if (!validEmail(email)) return redirectWithError(request, "email", email);
  if (!validPassword(password)) return redirectWithError(request, "senha", email);
  if (password !== passwordConfirmation) return redirectWithError(request, "confirmacao", email);

  const account = await readAccountToken(cookieFromRequest(request, ACCOUNT_COOKIE));
  if (!account || account.email !== email || !(await recoveryCodeMatches(account, recoveryCode))) {
    return redirectWithError(request, "credenciais", email);
  }

  const updated = await resetAccountPassword(account, password);
  const loginUrl = absoluteAppUrl(request, "/login");
  loginUrl.searchParams.set("senha", "alterada");
  loginUrl.searchParams.set("email", email);

  const response = NextResponse.redirect(loginUrl, 303);
  response.cookies.set(ACCOUNT_COOKIE, updated.accountToken, accountCookieOptions());
  response.cookies.set(RECOVERY_CODE_COOKIE, updated.recoveryCode, recoveryCodeCookieOptions());
  response.cookies.delete(SESSION_COOKIE);
  return response;
}
