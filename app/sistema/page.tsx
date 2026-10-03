import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getSession, RECOVERY_CODE_COOKIE } from "../lib/auth";
import Dashboard from "./dashboard";

export const dynamic = "force-dynamic";

export default async function SistemaPage() {
  const session = await getSession();
  if (!session) redirect("/login?erro=sessao");
  const recoveryCode = (await cookies()).get(RECOVERY_CODE_COOKIE)?.value ?? "";

  return <Dashboard name={session.name} email={session.email} recoveryCode={recoveryCode} />;
}
