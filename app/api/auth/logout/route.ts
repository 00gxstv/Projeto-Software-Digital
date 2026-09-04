import { NextResponse } from "next/server";
import { SESSION_COOKIE, absoluteAppUrl, requestHasValidOrigin } from "../../../lib/auth";

export async function POST(request: Request) {
  if (!requestHasValidOrigin(request)) {
    return new Response("Origem da requisição não permitida.", { status: 403 });
  }

  const response = NextResponse.redirect(absoluteAppUrl(request, "/login?sessao=encerrada"), 303);
  response.cookies.delete(SESSION_COOKIE);
  return response;
}
