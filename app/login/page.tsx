import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "../lib/auth";

export const dynamic = "force-dynamic";

type LoginPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  if (await getSession()) redirect("/sistema");

  const params = await searchParams;
  const email = first(params.email).slice(0, 254);
  const registered = first(params.cadastro) === "sucesso";
  const loginError = first(params.erro) === "credenciais";
  const sessionRequired = first(params.erro) === "sessao";
  const signedOut = first(params.sessao) === "encerrada";
  const passwordChanged = first(params.senha) === "alterada";

  return (
    <main className="auth-page auth-page--login">
      <section className="auth-brand-panel" aria-label="Digital Mais">
        <Link href="/" aria-label="Voltar para a página inicial">
          <img className="brand-logo" src="/digital-mais-logo.png" alt="Digital Mais Acessórios" />
        </Link>
        <div className="auth-brand-copy">
          <h1>Olá, que bom ver você.</h1>
          <p>Entre para continuar o atendimento da Digital+.</p>
        </div>
        <Link className="auth-back-link" href="/">← Voltar ao site institucional</Link>
      </section>

      <section className="auth-form-panel">
        <div className="auth-card">
          <h2>Fazer login</h2>
          <p>Preencha seu e-mail e sua senha para continuar.</p>

          {registered && (
            <p className="auth-feedback auth-feedback--success" role="status">
              Confira seu e-mail para confirmar o cadastro. O acesso aos dados será liberado pela responsável da equipe.
            </p>
          )}
          {["confirmar", "conexao", "link"].includes(first(params.erro)) && <p className="auth-feedback auth-feedback--error" role="alert">{first(params.erro) === "confirmar" ? "Confirme seu e-mail antes de entrar." : first(params.erro) === "link" ? "O link expirou ou foi aberto em outro navegador. Solicite um novo link e abra no mesmo navegador." : "Não foi possível conectar. Tente novamente em instantes."}</p>}
          {loginError && (
            <p className="auth-feedback auth-feedback--error" role="alert">
              E-mail ou senha incorretos. Confira os dados e tente novamente.
            </p>
          )}
          {sessionRequired && (
            <p className="auth-feedback auth-feedback--error" role="alert">
              Faça login para acessar essa área do sistema.
            </p>
          )}
          {signedOut && (
            <p className="auth-feedback auth-feedback--success" role="status">
              Sua sessão foi encerrada com segurança.
            </p>
          )}
          {passwordChanged && (
            <p className="auth-feedback auth-feedback--success" role="status">
              Senha alterada com segurança. Entre usando sua nova senha.
            </p>
          )}

          <form className="auth-form" method="post" action="/api/auth/login">
            <div className="form-field">
              <label htmlFor="login-email">E-mail</label>
              <input
                id="login-email"
                name="email"
                type="email"
                defaultValue={email}
                autoComplete="email"
                inputMode="email"
                maxLength={254}
                required
              />
            </div>
            <div className="form-field">
              <label htmlFor="login-password">Senha</label>
              <input
                id="login-password"
                name="password"
                type="password"
                autoComplete="current-password"
                minLength={8}
                maxLength={128}
                required
              />
            </div>
            <Link className="forgot-password-link" href="/esqueci-senha">Esqueci minha senha</Link>
            <button className="auth-submit" type="submit">Entrar no sistema</button>
          </form>

          <p className="auth-switch">
            Ainda não tem cadastro? <Link href="/cadastro">Criar conta</Link>
          </p>
        </div>
      </section>
    </main>
  );
}
