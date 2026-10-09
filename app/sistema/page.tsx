import { redirect } from "next/navigation";
import { getSession } from "../lib/auth";
import { createClient } from "../lib/supabase/server";
import Dashboard from "./dashboard";

export const dynamic = "force-dynamic";
export default async function SistemaPage() {
  const session = await getSession();
  if (!session) redirect("/login?erro=sessao");
  const client = await createClient();
  const { data: access, error } = await client.from("digital_mais_acessos").select("user_id").eq("user_id", session.id).eq("ativo", true).maybeSingle();
  if (error || !access) return <main className="auth-page"><section className="auth-form-panel"><div className="auth-card"><h1>{error ? "Conexão em configuração" : "Aguardando liberação"}</h1><p>{error ? "Não foi possível verificar seu acesso. Tente novamente; se persistir, avise a responsável pelo sistema." : "Sua conta foi criada e aguarda aprovação da dona da assistência. Ela pode liberar seu acesso na área Acessos do sistema."}</p><p>{session.email}</p><a className="auth-submit" href="/sistema">Verificar novamente</a><form method="post" action="/api/auth/logout"><button className="secondary-action" type="submit">Sair</button></form></div></section></main>;
  return <Dashboard name={session.name} email={session.email} />;
}
