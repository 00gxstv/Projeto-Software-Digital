import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "../lib/auth";

export const dynamic = "force-dynamic";

type CadastroPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const errors: Record<string, string> = {
  "dados-invalidos": "Não foi possível validar os dados enviados. Tente novamente.",
  nome: "Informe seu nome com pelo menos 2 caracteres.",
  email: "Digite um endereço de e-mail válido.",
  senha: "A senha precisa ter de 8 a 128 caracteres, com letras e números.",
  confirmacao: "As duas senhas precisam ser iguais.",
};

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default async function CadastroPage({ searchParams }: CadastroPageProps) {
  if (await getSession()) redirect("/sistema");

  const params = await searchParams;
  const errorMessage = errors[first(params.erro)];

  return (
    <main className="auth-page">
      <section className="auth-brand-panel" aria-label="Digital Mais">
        <Link href="/" aria-label="Voltar para a página inicial">
          <img className="brand-logo" src="/digital-mais-logo.png" alt="Digital Mais Acessórios" />
        </Link>
        <div className="auth-brand-copy">
          <span>PRIMEIRO ACESSO</span>
          <h1>Crie seu acesso.</h1>
          <p>
            Faça um cadastro rápido. Ao concluir, você será levado ao login para entrar no sistema.
          </p>
        </div>
        <Link className="auth-back-link" href="/">← Voltar ao site institucional</Link>
      </section>

      <section className="auth-form-panel">
        <div className="auth-card">
          <h2>Criar conta</h2>
          <p>Use dados válidos para cadastrar seu acesso à demonstração.</p>

          {errorMessage && (
            <p className="auth-feedback auth-feedback--error" role="alert">{errorMessage}</p>
          )}

          <form className="auth-form" method="post" action="/api/auth/register">
            <input
              type="text"
              name="website"
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
              style={{ position: "absolute", left: "-10000px" }}
            />
            <div className="form-field">
              <label htmlFor="register-name">Nome completo</label>
              <input
                id="register-name"
                name="name"
                type="text"
                autoComplete="name"
                minLength={2}
                maxLength={80}
                required
              />
            </div>
            <div className="form-field">
              <label htmlFor="register-email">E-mail</label>
              <input
                id="register-email"
                name="email"
                type="email"
                autoComplete="email"
                inputMode="email"
                maxLength={254}
                required
              />
            </div>
            <div className="form-field">
              <label htmlFor="register-password">Senha</label>
              <input
                id="register-password"
                name="password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                maxLength={128}
                aria-describedby="password-hint"
                required
              />
              <p className="password-hint" id="password-hint">
                Use pelo menos 8 caracteres, incluindo uma letra e um número.
              </p>
            </div>
            <div className="form-field">
              <label htmlFor="register-confirmation">Confirmar senha</label>
              <input
                id="register-confirmation"
                name="passwordConfirmation"
                type="password"
                autoComplete="new-password"
                minLength={8}
                maxLength={128}
                required
              />
            </div>
            <button className="auth-submit" type="submit">Finalizar cadastro</button>
          </form>

          <p className="auth-switch">
            Já tem cadastro? <Link href="/login">Fazer login</Link>
          </p>
        </div>
      </section>
    </main>
  );
}
