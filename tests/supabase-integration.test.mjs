import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

test("ERP: permissões, transações, versões e isolamento entre lojas", async () => {
 const db = new PGlite();
 try {
 await db.exec(`
 create role anon; create role authenticated;
 create schema auth;
 create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 grant usage on schema auth,public to authenticated,anon;
 grant execute on function auth.uid() to authenticated,anon;
 `);
 await db.exec(await readFile(new URL("./fixtures/digital-mais-original.sql",import.meta.url),"utf8"));
 const migration = await readFile(new URL("../supabase/migrations/20261003014305_conectar_digital_mais.sql",import.meta.url),"utf8");
 await db.exec(migration);
 // Running twice must preserve records and remain safe.
 await db.exec(migration);
 await db.exec(`
 insert into auth.users values ('00000000-0000-0000-0000-000000000001'),('00000000-0000-0000-0000-000000000002');
 insert into lojas(nome,endereco) values ('Loja de teste A','Endereço de teste A'),('Loja de teste B','Endereço de teste B');
 insert into funcionarios(nome) values ('Funcionário de teste');
 insert into digital_mais_acessos(user_id,funcionario_id) values ('00000000-0000-0000-0000-000000000001',1);
 set role authenticated;
 select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',false);
 `);
 await assert.rejects(db.query("select digital_mais_snapshot()"), /Acesso ainda/);
 assert.equal((await db.query("select * from lojas")).rows.length,0);
 await assert.rejects(db.exec("insert into clientes(nome,telefone) values ('Bloqueado','0')"),/row-level security/);
 await assert.rejects(db.exec("insert into digital_mais_acessos(user_id,funcionario_id) values ('00000000-0000-0000-0000-000000000002',1)"),/permission denied/);
 await assert.rejects(db.exec("truncate clientes cascade"), /permission denied/);
 await db.exec("select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false)");
 const mutate=async (action,payload,store=1)=>(await db.query("select digital_mais_mutate($1,$2,$3::jsonb) result",[action,store,JSON.stringify(payload)])).rows[0].result;
 const snapshot=async (store=1)=>(await db.query("select digital_mais_snapshot($1) result",[store])).rows[0].result;
 await mutate("saveClient",{name:"Cliente teste",phone:"11999999999",email:"teste@example.invalid",document:"123"});
 await mutate("saveStock",{name:"Tela teste",sku:"TESTE",quantity:5,minimum:2,cost:10,price:20});
 let state=await snapshot(); assert.equal(state.stores.length,2); assert.equal(state.clients.length,1); assert.equal(state.stock[0].quantity,5);
 const client=state.clients[0], stock=state.stock[0];
 const order={clientId:client.id,device:"Aparelho teste",service:"Reparo",status:"Em reparo",technician:"Técnico teste",dueDate:"2026-10-09",paymentMethod:"Pix",paymentStatus:"Pendente",notes:"Observação",value:60,parts:[{stockItemId:stock.id,quantity:2,unitPrice:20}]};
 await mutate("saveOrder",order);
 state=await snapshot(); assert.equal(state.stock[0].quantity,3); assert.equal(state.orders[0].value,60); assert.equal(state.orders[0].parts[0].quantity,2);
 assert.equal((await snapshot(2)).orders.length,0); assert.equal((await snapshot(2)).stock[0].quantity,0);
 const original=state.orders[0];
 await assert.rejects(mutate("saveOrder",{...original,parts:[{stockItemId:stock.id,quantity:99,unitPrice:20}]}),/Estoque insuficiente/);
 state=await snapshot(); assert.equal(state.stock[0].quantity,3); assert.equal(state.orders[0].parts[0].quantity,2); assert.equal(state.orders[0].version,original.version);
 await assert.rejects(mutate("saveOrder",{...original,parts:[{stockItemId:stock.id,quantity:1.5,unitPrice:20}]}),/inválido/);
 await mutate("saveOrder",{...original,parts:[{stockItemId:stock.id,quantity:3,unitPrice:20}]});
 state=await snapshot(); assert.equal(state.stock[0].quantity,2);
 await assert.rejects(mutate("saveOrder",original),/alterada por outra pessoa/);
 await assert.rejects(mutate("status",{id:original.id,version:state.orders[0].version,status:"Pronto"},2),/alterada por outra pessoa/);
 await mutate("status",{id:original.id,version:state.orders[0].version,status:"Cancelado"});
 state=await snapshot(); assert.equal(state.stock[0].quantity,5); assert.equal(state.orders[0].parts.length,0); assert.equal(state.orders[0].status,"Cancelado");
 await mutate("deleteOrder",{id:original.id,version:state.orders[0].version});
 assert.equal((await snapshot()).orders.length,0);
 assert.ok((await db.query("select * from movimentacoes_estoque")).rows.length>=3);
 await mutate("saveOrder",order); state=await snapshot();
 await mutate("deleteOrder",{id:state.orders[0].id,version:state.orders[0].version});
 assert.equal((await snapshot()).stock[0].quantity,5);
 await mutate("quantity",{id:stock.id,amount:-1},1);
 await assert.rejects(mutate("quantity",{id:stock.id,amount:-1},2),/Estoque insuficiente/);
 assert.equal((await snapshot()).stock[0].quantity,4);
 await assert.rejects(mutate("saveStock",{...stock,quantity:9}),/alterado por outra pessoa/);
 await mutate("saveClient",{...client,name:"Atualizado"});
 await assert.rejects(mutate("saveClient",{...client,name:"Desatualizado"}),/alterado por outra pessoa/);
 await db.exec("reset role; update digital_mais_acessos set ativo=false; set role authenticated");
 await assert.rejects(snapshot(),/Acesso ainda/);
 assert.equal((await db.query("select * from clientes")).rows.length,0);
 await db.exec("reset role; set role anon");
 await assert.rejects(snapshot(),/permission denied/);
 await assert.rejects(db.query("select * from clientes"),/permission denied/);
 } finally { await db.close(); }
});
