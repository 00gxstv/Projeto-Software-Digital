import { redirect } from "next/navigation";
import { getSession } from "../lib/auth";
import Dashboard from "./dashboard";

export const dynamic = "force-dynamic";

export default async function SistemaPage() {
  const session = await getSession();
  if (!session) redirect("/login?erro=sessao");

  return <Dashboard name={session.name} email={session.email} />;
}
