import { NextResponse } from "next/server";
import { createClient } from "../../lib/supabase/server";
import { requestHasValidOrigin } from "../../lib/auth";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
function failure(error: { code?: string; message?: string }) {
  const message = error.code === "P0001" ? error.message :
    error.code === "42501" ? "Seu acesso aos dados ainda não foi liberado pela equipe." :
    error.code === "23505" ? "Já existe um cadastro com este documento ou código." :
    error.code === "23503" ? "Este registro possui vínculos e não pode ser excluído." :
    error.code?.startsWith("22") || error.code === "23514" || error.code === "23502" ? "Confira os campos e os valores informados." :
    ["PGRST202", "42P01", "42703"].includes(error.code ?? "") ? "A integração do banco ainda precisa ser configurada pela equipe." :
    "Não foi possível acessar o banco. Tente novamente.";
  return NextResponse.json({ error: message }, { status: error.code === "42501" ? 403 : 400, headers });
}
export async function GET(request: Request) {
  try {
    const client = await createClient();
    const { data: { user } } = await client.auth.getUser();
    if (!user) return NextResponse.json({ error: "Sessão encerrada. Faça login novamente." }, { status: 401, headers });
    const store = new URL(request.url).searchParams.get("store");
    if (store && !/^\d+$/.test(store)) return failure({ code: "22000" });
    const { data, error } = await client.rpc("digital_mais_snapshot", { p_loja_id: store || null });
    return error ? failure(error) : NextResponse.json(data, { headers });
  } catch { return NextResponse.json({ error: "Sem conexão com o banco. Tente novamente." }, { status: 503, headers }); }
}
export async function POST(request: Request) {
  if (!requestHasValidOrigin(request)) return NextResponse.json({ error: "Origem não permitida." }, { status: 403, headers });
  try {
    if (Number(request.headers.get("content-length") ?? 0) > 100000) return failure({ code: "22000" });
    const body = await request.json();
    if (!/^\d+$/.test(String(body.storeId)) || !["saveClient", "deleteClient", "saveStock", "deleteStock", "quantity", "saveOrder", "deleteOrder", "status"].includes(body.action)) return failure({ code: "22000" });
    const client = await createClient();
    const { data: { user } } = await client.auth.getUser();
    if (!user) return NextResponse.json({ error: "Sessão encerrada. Faça login novamente." }, { status: 401, headers });
    const { data, error } = await client.rpc("digital_mais_mutate", { p_action: body.action, p_loja_id: body.storeId, p_payload: body.payload });
    return error ? failure(error) : NextResponse.json(data, { headers });
  } catch { return NextResponse.json({ error: "Não foi possível confirmar a operação. Atualize os dados antes de tentar novamente." }, { status: 503, headers }); }
}
