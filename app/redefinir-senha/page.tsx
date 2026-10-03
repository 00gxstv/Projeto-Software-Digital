import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "../lib/auth";

export const dynamic = "force-dynamic";
export default async function ResetPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  if (!(await getSession())) redirect("/esqueci-senha");
  const params = await searchParams;
  return <main className="auth-page"><section className="auth-brand-panel"><Link href="/"><img className="brand-logo" src="/digital-mais-logo.png" alt="Digital Mais" /></Link><div className="auth-brand-copy"><h1>Crie sua nova senha.</h1><p>Seu acesso funciona em qualquer computador da equipe.</p></div></section><section className="auth-form-panel"><div className="auth-card"><h2>Redefinir senha</h2>{params.erro && <p role="alert" className="auth-feedback auth-feedback--error">Não foi possível trocar a senha. Use uma senha nova com 8 a 128 caracteres, letras e números, e confirme os dois campos.</p>}<form className="auth-form" method="post" action="/api/auth/password"><div className="form-field"><label htmlFor="password">Nova senha</label><input id="password" name="password" type="password" autoComplete="new-password" minLength={8} maxLength={128} required /></div><div className="form-field"><label htmlFor="confirm">Confirmar senha</label><input id="confirm" name="passwordConfirmation" type="password" autoComplete="new-password" minLength={8} maxLength={128} required /></div><button className="auth-submit" type="submit">Salvar nova senha</button></form></div></section></main>;
}
