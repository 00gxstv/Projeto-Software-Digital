import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "../lib/auth";

export const dynamic = "force-dynamic";

type RecoveryPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const errors: Record<string, string> = {
  "dados-invalidos": "Não foi possível validar os dados enviados. Tente novamente.",
  envio: "Não foi possível enviar o link. Aguarde alguns minutos e tente novamente.",
  email: "Digite um endereço de e-mail válido.",
  senha: "A nova senha precisa ter de 8 a 128 caracteres, com letras e números.",
  confirmacao: "As duas senhas precisam ser iguais.",
  credenciais: "E-mail ou código de recuperação incorretos.",
};

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default async function RecoveryPage({ searchParams }: RecoveryPageProps) {
  if (await getSession()) redirect("/sistema");
  const params = await searchParams;
  const email = first(params.email).slice(0, 254);
  const errorMessage = errors[first(params.erro)];

  return (
    <main className="auth-page">
      <section className="auth-brand-panel" aria-label="Digital Mais">
        <Link href="/" aria-label="Voltar para a página inicial">
          <img className="brand-logo" src="/digital-mais-logo.png" alt="Digital Mais Acessórios" />
        </Link>
        <div className="auth-brand-copy">
          <h1>Vamos recuperar seu acesso.</h1>
          <p>Receba um link por e-mail para criar uma nova senha.</p>
        </div>
        <Link className="auth-back-link" href="/login">← Voltar ao login</Link>
      </section>

      <section className="auth-form-panel">
        <div className="auth-card">
          <h2>Esqueci minha senha</h2>
          <p>Informe o e-mail da sua conta. Abra o link recebido neste mesmo navegador.</p>

          {first(params.enviado) === "1" && <p className="auth-feedback auth-feedback--success" role="status">Se houver uma conta com esse e-mail, você receberá um link de recuperação.</p>}
          {errorMessage && <p className="auth-feedback auth-feedback--error" role="alert">{errorMessage}</p>}

          <form className="auth-form" method="post" action="/api/auth/recover">
            <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" style={{ position: "absolute", left: "-10000px" }} />
            <div className="form-field">
              <label htmlFor="recovery-email">E-mail</label>
              <input id="recovery-email" name="email" type="email" defaultValue={email} autoComplete="email" inputMode="email" maxLength={254} required />
            </div>
            <button className="auth-submit" type="submit">Enviar link de recuperação</button>
          </form>

          <p className="auth-switch">Lembrou a senha? <Link href="/login">Fazer login</Link></p>
        </div>
      </section>
    </main>
  );
}
