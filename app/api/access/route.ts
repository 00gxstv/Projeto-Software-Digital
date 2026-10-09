import { NextResponse } from "next/server";
import { createClient } from "../../lib/supabase/server";
import { requestHasValidOrigin } from "../../lib/auth";
export async function POST(request: Request) {
 const headers={"Cache-Control":"private, no-store"};
 if(!requestHasValidOrigin(request))return NextResponse.json({error:"Origem não permitida."},{status:403,headers});
 try {
  const client=await createClient();const {data:{user}}=await client.auth.getUser();
  if(!user)return NextResponse.json({error:"Faça login novamente."},{status:401,headers});
  const body=await request.json();
  if(typeof body.id!=="string"||!(/^[0-9a-f-]{36}$/i.test(body.id))||!["aprovado","recusado","suspenso"].includes(body.decision))return NextResponse.json({error:"Dados inválidos."},{status:400,headers});
  const {data,error}=await client.rpc("digital_mais_decide_access",{p_user:body.id,p_decision:body.decision});
  return error?NextResponse.json({error:error.code==="42501"?"Somente a dona pode gerenciar acessos.":"Não foi possível alterar este acesso."},{status:403,headers}):NextResponse.json(data,{headers});
 } catch {return NextResponse.json({error:"Falha de conexão. Atualize antes de tentar novamente."},{status:503,headers});}
}
