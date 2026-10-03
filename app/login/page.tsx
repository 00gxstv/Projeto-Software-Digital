import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import Link from "next/link";
import { getSession, RECOVERY_CODE_COOKIE } from "../lib/auth";

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
  const recoveryCode = (await cookies()).get(RECOVERY_CODE_COOKIE)?.value ?? "";

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
              Cadastro concluído. Agora faça login para entrar no sistema.
            </p>
          )}
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
          {recoveryCode && (
            <aside className="recovery-code-card" aria-label="Código de recuperação">
              <strong>Guarde seu código de recuperação</strong>
              <code>{recoveryCode}</code>
              <p>Ele é exibido por 15 minutos e será necessário caso você esqueça a senha. Não compartilhe com outras pessoas.</p>
            </aside>
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
