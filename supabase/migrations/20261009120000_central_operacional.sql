-- Extensão compatível: preserva campos, dados e fluxo transacional existentes.
create schema if not exists digital_mais_private;
revoke all on schema digital_mais_private from public, anon;
grant usage on schema digital_mais_private to authenticated;
alter table public.digital_mais_acessos add column if not exists papel text not null default 'equipe' check(papel in ('dono','equipe'));
alter table public.digital_mais_acessos add column if not exists email text;
alter table public.digital_mais_acessos add column if not exists decisao text not null default 'pendente' check(decisao in ('pendente','aprovado','recusado','suspenso'));
alter table public.digital_mais_acessos add column if not exists decidido_em timestamptz;
alter table public.digital_mais_acessos add column if not exists decidido_por uuid;
update public.digital_mais_acessos a set email=u.email,decisao=case when a.ativo then 'aprovado' else a.decisao end from auth.users u where u.id=a.user_id;
alter table public.digital_mais_acessos alter column ativo set default false;
alter table public.ordens_servico add column if not exists resumo_servico text;
alter table public.ordens_servico add column if not exists etapa_servico text;

-- Consulta interna: impede recursão de RLS e não aceita um usuário arbitrário.
create or replace function digital_mais_private.is_owner() returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.digital_mais_acessos a join public.funcionarios f on f.id=a.funcionario_id where a.user_id=auth.uid() and a.ativo and a.papel='dono' and f.ativo)
$$;
revoke all on function digital_mais_private.is_owner() from public,anon;
grant execute on function digital_mais_private.is_owner() to authenticated;
drop policy if exists acesso_proprio on public.digital_mais_acessos;
create policy acesso_proprio on public.digital_mais_acessos for select to authenticated using(user_id=(select auth.uid()) or (select digital_mais_private.is_owner()));

-- Trigger de cadastro: nenhum usuário novo pode se autoaprovar ou escolher o papel.
create or replace function digital_mais_private.vincular_conta() returns trigger language plpgsql security definer set search_path='' as $$
declare v_func bigint;
begin
 if coalesce(new.is_anonymous,false) or new.email is null then return new; end if;
 if exists(select 1 from public.digital_mais_acessos where user_id=new.id) then return new; end if;
 insert into public.funcionarios(nome) values(left(coalesce(nullif(btrim(new.raw_user_meta_data->>'name'),''),split_part(new.email,'@',1)),80)) returning id into v_func;
 insert into public.digital_mais_acessos(user_id,funcionario_id,ativo,email,decisao,papel) values(new.id,v_func,false,new.email,'pendente','equipe');
 return new;
end $$;
revoke all on function digital_mais_private.vincular_conta() from public,anon,authenticated;
drop trigger if exists digital_mais_vincular_conta on auth.users;
create trigger digital_mais_vincular_conta after insert or update of email_confirmed_at on auth.users for each row execute function digital_mais_private.vincular_conta();

create table if not exists public.digital_mais_access_log(id bigint generated always as identity primary key,actor uuid not null,target uuid not null,decision text not null,created_at timestamptz not null default now());
alter table public.digital_mais_access_log enable row level security;
revoke all on public.digital_mais_access_log from public,anon,authenticated;
grant select on public.digital_mais_access_log to authenticated;
create policy owner_audit on public.digital_mais_access_log for select to authenticated using((select digital_mais_private.is_owner()));
create or replace function digital_mais_private.decide_access(p_user uuid,p_decision text) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not digital_mais_private.is_owner() then raise exception 'Somente o dono pode gerenciar acessos.' using errcode='42501'; end if;
 if p_decision not in ('aprovado','recusado','suspenso') or p_decision is null then raise exception 'Decisão inválida.'; end if;
 if p_user=auth.uid() then raise exception 'Você não pode alterar seu próprio acesso.'; end if;
 perform pg_advisory_xact_lock(731902602);
 update public.digital_mais_acessos set ativo=p_decision='aprovado',decisao=p_decision,decidido_em=now(),decidido_por=auth.uid() where user_id=p_user and papel<>'dono';
 if not found then raise exception 'Conta não encontrada ou protegida.'; end if;
 insert into public.digital_mais_access_log(actor,target,decision) values(auth.uid(),p_user,p_decision);
 return jsonb_build_object('ok',true);
end $$;
revoke all on function digital_mais_private.decide_access(uuid,text) from public,anon;
grant execute on function digital_mais_private.decide_access(uuid,text) to authenticated;
create or replace function public.digital_mais_decide_access(p_user uuid,p_decision text) returns jsonb language sql security invoker set search_path='' as $$ select digital_mais_private.decide_access(p_user,p_decision) $$;
revoke all on function public.digital_mais_decide_access(uuid,text) from public,anon;
grant execute on function public.digital_mais_decide_access(uuid,text) to authenticated;

-- Insights sem valores agregados de clientes para a equipe.
create or replace function public.digital_mais_insights(p_loja_id bigint) returns jsonb language plpgsql security invoker set search_path='' as $$
declare v_result jsonb;
begin
 if not exists(select 1 from public.digital_mais_acessos where user_id=auth.uid() and ativo) then raise exception 'Acesso ainda não liberado pela equipe.' using errcode='42501'; end if;
 select jsonb_build_object(
 'devices',coalesce((select jsonb_agg(jsonb_build_object('id',id::text,'clientId',cliente_id::text,'device',modelo,'imei',coalesce(imei,''),'color',coalesce(cor,''))) from public.aparelhos),'[]'::jsonb),
 'visits',coalesce((select jsonb_agg(jsonb_build_object('id','OS-'||o.id,'clientId',o.cliente_id::text,'deviceId',a.id::text,'device',a.modelo,'service',o.defeito_relatado,'createdAt',o.criado_em,'storeId',o.loja_id::text,'store',l.nome,'status',o.status,'summary',coalesce(o.resumo_servico,'')) order by o.criado_em desc) from public.ordens_servico o join public.aparelhos a on a.id=o.aparelho_id join public.lojas l on l.id=o.loja_id),'[]'::jsonb),
 'customerSpend',case when digital_mais_private.is_owner() then coalesce((select jsonb_object_agg(cliente_id::text,total) from (select cliente_id,sum(valor_pecas+valor_mao_obra-desconto) total from public.ordens_servico where status='entregue' group by cliente_id) q),'{}'::jsonb) else '{}'::jsonb end,
 'movements',coalesce((select jsonb_agg(jsonb_build_object('id',m.id::text,'stockItemId',m.produto_id::text,'name',p.nome,'quantity',m.quantidade,'type',m.tipo,'note',coalesce(m.observacoes,''),'createdAt',m.criado_em,'before',m.saldo_anterior,'after',m.saldo_posterior) order by m.id desc) from (select * from public.movimentacoes_estoque where loja_id=p_loja_id order by id desc limit 100) m join public.produtos p on p.id=m.produto_id),'[]'::jsonb),
 'consumption',coalesce((select jsonb_object_agg(produto_id::text,net) from (select produto_id,greatest(0,sum(case when tipo='uso_os' then quantidade when tipo='ajuste_entrada' and observacoes like '%devolução de peças%' then -quantidade else 0 end)) net from public.movimentacoes_estoque where loja_id=p_loja_id and criado_em>=now()-interval '90 days' group by produto_id) q),'{}'::jsonb),
 'team',case when digital_mais_private.is_owner() then coalesce((select jsonb_agg(jsonb_build_object('id',a.user_id,'name',f.nome,'email',a.email,'role',a.papel,'decision',a.decisao,'active',a.ativo,'createdAt',a.criado_em) order by a.criado_em desc) from public.digital_mais_acessos a join public.funcionarios f on f.id=a.funcionario_id),'[]'::jsonb) else '[]'::jsonb end
 ) into v_result;
 return v_result;
end $$;
revoke all on function public.digital_mais_insights(bigint) from public,anon;
grant execute on function public.digital_mais_insights(bigint) to authenticated;

alter table public.movimentacoes_estoque add column if not exists saldo_anterior integer;
alter table public.movimentacoes_estoque add column if not exists saldo_posterior integer;
create or replace function digital_mais_private.movement_balance() returns trigger language plpgsql security invoker set search_path='' as $$
declare v_saldo integer;
begin
 select quantidade into v_saldo from public.estoque where loja_id=new.loja_id and produto_id=new.produto_id;
 if new.tipo in ('uso_os','ajuste_entrada','ajuste_saida') then
 new.saldo_posterior:=v_saldo;
 new.saldo_anterior:=case when new.tipo in ('uso_os','ajuste_saida') then v_saldo+new.quantidade else v_saldo-new.quantidade end;
 end if;
 return new;
end $$;
revoke all on function digital_mais_private.movement_balance() from public,anon,authenticated;
create trigger digital_mais_movement_balance before insert on public.movimentacoes_estoque for each row execute function digital_mais_private.movement_balance();
CREATE OR REPLACE FUNCTION public.digital_mais_snapshot(p_loja_id bigint DEFAULT NULL::bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare v_loja bigint; v_result jsonb;
begin
  if not exists(select 1 from public.digital_mais_acessos where user_id = auth.uid() and ativo) then
    raise exception 'Acesso ainda não liberado pela equipe.' using errcode = '42501';
  end if;
  select id into v_loja from public.lojas where ativo and (p_loja_id is null or id = p_loja_id) order by id limit 1;
  if p_loja_id is not null and v_loja is null then raise exception 'Loja não encontrada ou inativa.'; end if;
  select jsonb_build_object(
    'storeId', v_loja::text,'isOwner',digital_mais_private.is_owner(),
    'stores', coalesce((select jsonb_agg(jsonb_build_object('id', id::text, 'name', nome) order by id) from public.lojas where ativo), '[]'::jsonb),
    'clients', coalesce((select jsonb_agg(jsonb_build_object('id', id::text,'name',nome,'phone',telefone,'email',coalesce(email,''),'document',coalesce(cpf,''),'createdAt',criado_em,'version',versao) order by id desc) from public.clientes), '[]'::jsonb),
    'stock', coalesce((select jsonb_agg(jsonb_build_object('id',p.id::text,'name',p.nome,'sku',coalesce(p.sku,''),'quantity',coalesce(e.quantidade,0),'minimum',coalesce(e.estoque_minimo,0),'cost',p.preco_custo,'price',p.preco_venda,'createdAt',p.criado_em,'version',coalesce(e.versao,0),'productVersion',p.versao) order by p.id desc) from public.produtos p left join public.estoque e on e.produto_id=p.id and e.loja_id=v_loja where p.ativo and coalesce(e.ativo,true) and v_loja is not null), '[]'::jsonb),
    'orders', coalesce((select jsonb_agg(jsonb_build_object(
      'id','OS-'||o.id,'clientId',o.cliente_id::text,'device',a.modelo,'deviceId',a.id::text,'imei',coalesce(a.imei,''),'color',coalesce(a.cor,''),'diagnosis',coalesce(o.diagnostico,''),'summary',coalesce(o.resumo_servico,''),'stage',coalesce(o.etapa_servico,''),'labor',o.valor_mao_obra,'discount',o.desconto,
      'service',o.defeito_relatado,'status',case when o.aguardando_peca and o.status='em_andamento' then 'Aguardando peça' else case o.status when 'aguardando_avaliacao' then 'Em análise' when 'aguardando_aprovacao' then 'Aguardando aprovação' when 'aprovado' then 'Aprovado' when 'em_andamento' then 'Em reparo' when 'concluido' then 'Pronto' when 'entregue' then 'Entregue' when 'cancelado' then 'Cancelado' end end,
      'technician',coalesce(o.tecnico_nome,f.nome),'dueDate',coalesce(o.prazo_entrega::text,''),
      'paymentMethod',o.forma_pagamento,'paymentStatus',o.situacao_pagamento,
      'notes',coalesce(o.observacoes,''),'history',o.historico,'version',o.versao,
      'value',o.valor_pecas+o.valor_mao_obra-o.desconto,'createdAt',o.criado_em,'updatedAt',o.atualizado_em,
      'parts',coalesce((select jsonb_agg(jsonb_build_object('stockItemId',i.produto_id::text,'name',p.nome,'quantity',i.quantidade,'unitPrice',i.valor_unitario) order by i.id) from public.itens_ordem_servico i join public.produtos p on p.id=i.produto_id where i.ordem_servico_id=o.id),'[]'::jsonb)
    ) order by o.id desc) from public.ordens_servico o join public.aparelhos a on a.id=o.aparelho_id join public.funcionarios f on f.id=o.funcionario_id where o.loja_id=v_loja), '[]'::jsonb)
  ) into v_result;
  return v_result || public.digital_mais_insights(v_loja);
end $function$
;
CREATE OR REPLACE FUNCTION public.digital_mais_mutate(p_action text, p_loja_id bigint, p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  v_actor bigint; v_id bigint; v_version integer; v_stock_existed boolean;
  v_order public.ordens_servico%rowtype; v_stock public.estoque%rowtype;
  v_product public.produtos%rowtype; v_client public.clientes%rowtype;
  v_device bigint; v_status text; v_ui_status text; v_parts jsonb;
  v_part record; v_old integer; v_new integer; v_delta integer; v_qty integer;
  v_total numeric; v_parts_total numeric; v_action text;
begin
  select a.funcionario_id into v_actor from public.digital_mais_acessos a join public.funcionarios f on f.id=a.funcionario_id where a.user_id=auth.uid() and a.ativo and f.ativo;
  if v_actor is null then raise exception 'Acesso ainda não liberado pela equipe.' using errcode='42501'; end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then raise exception 'Dados inválidos.'; end if;
  if not exists(select 1 from public.lojas where id=p_loja_id and ativo) then raise exception 'Selecione uma loja ativa.'; end if;
  -- Serializa mutações do ERP; as duas unidades compartilham produtos e clientes.
  -- Bloqueios de linha também protegem quantidades contra alterações concorrentes.
  perform pg_advisory_xact_lock(731902601);
  v_id := nullif(replace(p_payload->>'id','OS-',''),'')::bigint;
  v_version := coalesce((p_payload->>'version')::integer,0);

  if p_action='saveClient' then
    if nullif(trim(p_payload->>'name'),'') is null or nullif(trim(p_payload->>'phone'),'') is null then raise exception 'Preencha nome e telefone.'; end if;
    if v_id is null then
      insert into public.clientes(nome,telefone,email,cpf) values(trim(p_payload->>'name'),trim(p_payload->>'phone'),nullif(trim(p_payload->>'email'),''),nullif(trim(p_payload->>'document'),'')) returning id into v_id;
    else
      update public.clientes set nome=trim(p_payload->>'name'), telefone=trim(p_payload->>'phone'), email=nullif(trim(p_payload->>'email'),''), cpf=nullif(trim(p_payload->>'document'),''), versao=versao+1 where id=v_id and versao=v_version;
      if not found then raise exception 'Registro alterado por outra pessoa. Atualize a página antes de salvar.'; end if;
    end if;
  elsif p_action='deleteClient' then
    perform 1 from public.clientes where id=v_id and versao=v_version for update;
    if not found then raise exception 'Registro alterado por outra pessoa. Atualize a página.'; end if;
    if exists (
      select 1 from public.ordens_servico o
      where o.cliente_id=v_id
         or o.aparelho_id in (select a.id from public.aparelhos a where a.cliente_id=v_id)
    ) then
      raise exception 'Este cliente ainda possui uma ordem de serviço vinculada. Confira também a outra unidade.';
    end if;
    -- Remove only this customer's devices with no remaining service orders.
    delete from public.aparelhos a
      where a.cliente_id=v_id
      and not exists(select 1 from public.ordens_servico o where o.aparelho_id=a.id);
    delete from public.clientes where id=v_id and versao=v_version;
    if not found then raise exception 'Registro alterado por outra pessoa. Atualize a página.'; end if;

  elsif p_action in ('saveStock','quantity','deleteStock') then
    if p_action='saveStock' and v_id is null then
      if nullif(trim(p_payload->>'name'),'') is null then raise exception 'Informe o nome do produto.'; end if;
      insert into public.produtos(nome,categoria,sku,preco_custo,preco_venda) values(trim(p_payload->>'name'),'Peças e acessórios',nullif(trim(p_payload->>'sku'),''),(p_payload->>'cost')::numeric,(p_payload->>'price')::numeric) returning id into v_id;
    end if;
    select * into v_product from public.produtos where id=v_id and ativo for update;
    if not found then raise exception 'Produto não encontrado.'; end if;
    select exists(select 1 from public.estoque where loja_id=p_loja_id and produto_id=v_id) into v_stock_existed;
    insert into public.estoque(loja_id,produto_id) values(p_loja_id,v_id) on conflict do nothing;
    select * into v_stock from public.estoque where loja_id=p_loja_id and produto_id=v_id for update;
    if p_action in ('saveStock','deleteStock') and p_payload->>'id' is not null then
      if (v_stock_existed and v_stock.versao<>v_version) or (not v_stock_existed and v_version<>0) or v_product.versao<>coalesce((p_payload->>'productVersion')::integer,-1) then
        raise exception 'Registro alterado por outra pessoa. Atualize a página antes de salvar.';
      end if;
    end if;
    if p_action='deleteStock' then
      if v_stock.quantidade<>0 then raise exception 'Zere o saldo antes de retirar este produto da loja.'; end if;
      if exists(select 1 from public.itens_ordem_servico i join public.ordens_servico o on o.id=i.ordem_servico_id where i.produto_id=v_id and o.loja_id=p_loja_id) then raise exception 'Produto vinculado a uma ordem de serviço.'; end if;
      update public.estoque set ativo=false, versao=versao+1, atualizado_em=now() where loja_id=p_loja_id and produto_id=v_id;
    else
      if p_action='quantity' then
        v_delta := (p_payload->>'amount')::integer;
        if v_delta is null or v_delta not in (-1,1) then raise exception 'Quantidade inválida.'; end if;
        v_qty := v_stock.quantidade+v_delta;
      else
        if (p_payload->>'quantity')::numeric <> trunc((p_payload->>'quantity')::numeric) or (p_payload->>'minimum')::numeric <> trunc((p_payload->>'minimum')::numeric) then raise exception 'Use quantidades inteiras.'; end if;
        v_qty := (p_payload->>'quantity')::integer;
        update public.produtos set nome=trim(p_payload->>'name'), sku=nullif(trim(p_payload->>'sku'),''), preco_custo=(p_payload->>'cost')::numeric, preco_venda=(p_payload->>'price')::numeric, versao=versao+1 where id=v_id;
      end if;
      if v_qty is null or v_qty<0 then raise exception 'Estoque insuficiente.'; end if;
      v_delta := v_qty-v_stock.quantidade;
      update public.estoque set quantidade=v_qty, estoque_minimo=case when p_action='saveStock' then (p_payload->>'minimum')::integer else estoque_minimo end, ativo=true, versao=versao+1, atualizado_em=now() where loja_id=p_loja_id and produto_id=v_id;
      if v_delta<>0 then
        insert into public.movimentacoes_estoque(loja_id,produto_id,funcionario_id,tipo,quantidade,observacoes) values(p_loja_id,v_id,v_actor,case when v_delta>0 then 'ajuste_entrada' else 'ajuste_saida' end,abs(v_delta),'Ajuste pelo ERP');
      end if;
    end if;

  elsif p_action in ('saveOrder','status','deleteOrder','event') then
    if v_id is not null then
      select * into v_order from public.ordens_servico where id=v_id and loja_id=p_loja_id for update;
      if not found or v_order.versao<>v_version then raise exception 'Ordem alterada por outra pessoa. Atualize a página antes de salvar.'; end if;
    elsif p_action<>'saveOrder' then raise exception 'Ordem não encontrada.';
    end if;
    if p_action='event' then
      if nullif(btrim(p_payload->>'event'),'') is null or length(p_payload->>'event')>400 then raise exception 'Descreva o evento (até 400 caracteres).'; end if;
      update public.ordens_servico set historico=historico||jsonb_build_array(jsonb_build_object('id',gen_random_uuid()::text,'at',now(),'action',btrim(p_payload->>'event'),'actorId',auth.uid())),versao=versao+1,atualizado_em=now() where id=v_id;
      return jsonb_build_object('ok',true,'id',v_id::text);
    end if;
    v_ui_status:=p_payload->>'status';
    v_status:=case v_ui_status when 'Em análise' then 'aguardando_avaliacao' when 'Aguardando aprovação' then 'aguardando_aprovacao' when 'Aprovado' then 'aprovado' when 'Em reparo' then 'em_andamento' when 'Aguardando peça' then 'em_andamento' when 'Pronto' then 'concluido' when 'Entregue' then 'entregue' when 'Cancelado' then 'cancelado' end;
    if p_action<>'deleteOrder' and v_status is null then raise exception 'Status inválido.'; end if;
    if p_action='saveOrder' then
      select * into v_client from public.clientes where id=(p_payload->>'clientId')::bigint;
      if not found then raise exception 'Cliente não encontrado.'; end if;
      if nullif(trim(p_payload->>'device'),'') is null or nullif(trim(p_payload->>'technician'),'') is null or nullif(trim(p_payload->>'service'),'') is null or nullif(p_payload->>'dueDate','') is null then raise exception 'Preencha aparelho, técnico, defeito e prazo.'; end if;
      if coalesce(p_payload->>'paymentMethod','') not in ('A definir','Pix','Dinheiro','Cartão de crédito','Cartão de débito','Boleto') or coalesce(p_payload->>'paymentStatus','') not in ('Pendente','Parcial','Pago') then raise exception 'Pagamento inválido.'; end if;
      v_parts := coalesce(p_payload->'parts','[]'::jsonb);
      if jsonb_typeof(v_parts)<>'array' then raise exception 'Peças inválidas.'; end if;
    else
      select coalesce(jsonb_agg(jsonb_build_object('stockItemId',produto_id::text,'quantity',quantidade,'unitPrice',valor_unitario)),'[]'::jsonb) into v_parts from public.itens_ordem_servico where ordem_servico_id=v_id;
    end if;
    if p_action='deleteOrder' or v_status='cancelado' then v_parts:='[]'::jsonb; end if;
    if exists(select 1 from jsonb_array_elements(v_parts) j where (j->>'quantity')::numeric is null or (j->>'quantity')::numeric<=0 or (j->>'quantity')::numeric<>trunc((j->>'quantity')::numeric) or (j->>'unitPrice')::numeric is null or (j->>'unitPrice')::numeric<0 or (j->>'stockItemId') is null) then raise exception 'Quantidade ou preço de peça inválido.'; end if;
    if (select count(*) from jsonb_array_elements(v_parts))<>(select count(distinct j->>'stockItemId') from jsonb_array_elements(v_parts) j) then raise exception 'Peça duplicada.'; end if;
    select coalesce(sum((j->>'quantity')::integer*(j->>'unitPrice')::numeric),0) into v_parts_total from jsonb_array_elements(v_parts) j;
    v_total:=case when p_action='saveOrder' then (p_payload->>'value')::numeric else coalesce(v_order.valor_pecas+v_order.valor_mao_obra-v_order.desconto,0) end;
    if v_total is null or v_total<0 then raise exception 'Valor total inválido.'; end if;
    if p_action='saveOrder' then
      -- Reutiliza o aparelho quando a identificação não muda. Nunca sobrescreve outro atendimento.
      if nullif(p_payload->>'deviceId','') is not null then
        select id into v_device from public.aparelhos where id=(p_payload->>'deviceId')::bigint and cliente_id=v_client.id and modelo=trim(p_payload->>'device');
        if not found then raise exception 'Aparelho não pertence a este cliente ou o modelo foi alterado. Selecione novo aparelho.'; end if;
      elsif v_id is not null and v_order.cliente_id=v_client.id and exists(select 1 from public.aparelhos where id=v_order.aparelho_id and modelo=trim(p_payload->>'device')) then v_device:=v_order.aparelho_id;
      else
        insert into public.aparelhos(cliente_id,marca,modelo) values(v_client.id,'Não informada',trim(p_payload->>'device')) returning id into v_device;
      end if;
      if p_payload ? 'imei' or p_payload ? 'color' then
        update public.aparelhos set imei=case when p_payload ? 'imei' then nullif(btrim(p_payload->>'imei'),'') else imei end,cor=case when p_payload ? 'color' then nullif(btrim(p_payload->>'color'),'') else cor end where id=v_device;
      end if;
      if v_id is null then
        insert into public.ordens_servico(loja_id,cliente_id,aparelho_id,funcionario_id,telefone_contato,defeito_relatado) values(p_loja_id,v_client.id,v_device,v_actor,v_client.telefone,trim(p_payload->>'service')) returning id into v_id;
      end if;
    end if;
    -- Ajusta apenas a diferença entre as peças antigas e novas, dentro da mesma transação.
    for v_part in
      select id from (
        select (j->>'stockItemId')::bigint id from jsonb_array_elements(v_parts) j
        union select produto_id from public.itens_ordem_servico where ordem_servico_id=v_id
      ) q order by id
    loop
      select coalesce(sum(quantidade),0) into v_old from public.itens_ordem_servico where ordem_servico_id=v_id and produto_id=v_part.id;
      select coalesce(sum((j->>'quantity')::integer),0) into v_new from jsonb_array_elements(v_parts) j where (j->>'stockItemId')::bigint=v_part.id;
      v_delta:=v_old-v_new;
      select * into v_stock from public.estoque where loja_id=p_loja_id and produto_id=v_part.id for update;
      if not found or (v_new>0 and not v_stock.ativo) then raise exception 'Peça não disponível nesta loja.'; end if;
      if v_stock.quantidade+v_delta<0 then raise exception 'Estoque insuficiente. Atualize a página e confira as peças.'; end if;
      if v_delta<>0 then
        update public.estoque set quantidade=quantidade+v_delta,versao=versao+1,atualizado_em=now() where loja_id=p_loja_id and produto_id=v_part.id;
        insert into public.movimentacoes_estoque(loja_id,produto_id,funcionario_id,ordem_servico_id,tipo,quantidade,observacoes) values(p_loja_id,v_part.id,v_actor,v_id,case when v_delta<0 then 'uso_os' else 'ajuste_entrada' end,abs(v_delta),'OS-'||v_id||': '||case when v_delta<0 then 'peças utilizadas' else 'devolução de peças' end);
      end if;
    end loop;
    delete from public.itens_ordem_servico where ordem_servico_id=v_id;
    if p_action='deleteOrder' then
      -- Mantém a trilha de estoque; mensagens vinculadas impedem exclusão via FK.
      update public.movimentacoes_estoque set ordem_servico_id=null where ordem_servico_id=v_id;
      delete from public.ordens_servico where id=v_id;
    else
      insert into public.itens_ordem_servico(ordem_servico_id,produto_id,quantidade,valor_unitario)
        select v_id,(j->>'stockItemId')::bigint,(j->>'quantity')::integer,(j->>'unitPrice')::numeric from jsonb_array_elements(v_parts) j;
      if p_action='saveOrder' and p_payload ? 'labor' then
        if (p_payload->>'labor')::numeric < 0 or (p_payload->>'discount')::numeric < 0 or (p_payload->>'discount')::numeric > (p_payload->>'labor')::numeric+v_parts_total then raise exception 'Confira mão de obra e desconto.'; end if;
        v_total:=(p_payload->>'labor')::numeric+v_parts_total-(p_payload->>'discount')::numeric;
      end if;
      v_action:=case when v_order.id is null then 'Ordem criada' when p_action='status' then 'Status alterado para '||v_ui_status else 'Ordem atualizada: '||v_ui_status||case when nullif(p_payload->>'stage','') is not null then ' · '||(p_payload->>'stage') else '' end end;
      update public.ordens_servico set
        cliente_id=case when p_action='saveOrder' then v_client.id else cliente_id end,
        aparelho_id=case when p_action='saveOrder' then v_device else aparelho_id end,
        telefone_contato=case when p_action='saveOrder' then v_client.telefone else telefone_contato end,
        defeito_relatado=case when p_action='saveOrder' then trim(p_payload->>'service') else defeito_relatado end,
        tecnico_nome=case when p_action='saveOrder' then trim(p_payload->>'technician') else tecnico_nome end,
        prazo_entrega=case when p_action='saveOrder' then (p_payload->>'dueDate')::date else prazo_entrega end,
        forma_pagamento=case when p_action='saveOrder' then p_payload->>'paymentMethod' else forma_pagamento end,
        situacao_pagamento=case when p_action='saveOrder' then p_payload->>'paymentStatus' else situacao_pagamento end,
        diagnostico=case when p_action='saveOrder' and p_payload ? 'diagnosis' then left(p_payload->>'diagnosis',4000) else diagnostico end,
        resumo_servico=case when p_action='saveOrder' and p_payload ? 'summary' then left(p_payload->>'summary',4000) else resumo_servico end,
        etapa_servico=case when p_action='saveOrder' and p_payload ? 'stage' then left(p_payload->>'stage',80) when p_action='status' then case v_ui_status when 'Em análise' then 'Diagnóstico iniciado' when 'Aguardando peça' then 'Peça solicitada' when 'Em reparo' then 'Reparo iniciado' when 'Pronto' then 'Pronto para retirada' else v_ui_status end else etapa_servico end,
        observacoes=case when p_action='saveOrder' then nullif(trim(p_payload->>'notes'),'') else observacoes end,
        status=v_status, aguardando_peca=v_ui_status='Aguardando peça',
        valor_pecas=v_parts_total,valor_mao_obra=case when p_action='saveOrder' and p_payload ? 'labor' then (p_payload->>'labor')::numeric when p_action='status' then valor_mao_obra else greatest(v_total-v_parts_total,0) end,desconto=case when p_action='saveOrder' and p_payload ? 'discount' then (p_payload->>'discount')::numeric when p_action='status' then least(desconto,valor_mao_obra+v_parts_total) else greatest(v_parts_total-v_total,0) end,
        data_conclusao=case when v_status in ('concluido','entregue') then coalesce(data_conclusao,now()) else null end,
        data_entrega=case when v_status='entregue' then coalesce(data_entrega,now()) else null end,
        historico=historico||jsonb_build_array(jsonb_build_object('id',gen_random_uuid()::text,'at',now(),'action',v_action,'actorId',auth.uid())),
        atualizado_em=now(),versao=versao+1
      where id=v_id;
    end if;
  else raise exception 'Operação não reconhecida.';
  end if;
  return jsonb_build_object('ok',true,'id',v_id::text);
end $function$
;
-- Rate limit persistente para a API de IA; independente do número de instâncias Vercel.
create table digital_mais_private.ai_usage(user_id uuid primary key references auth.users(id) on delete cascade,minute_start timestamptz not null default now(),minute_count integer not null default 0,day_start date not null default current_date,day_count integer not null default 0);
revoke all on digital_mais_private.ai_usage from public,anon,authenticated;
alter table digital_mais_private.ai_usage enable row level security;
create or replace function digital_mais_private.take_ai_quota() returns boolean language plpgsql security definer set search_path='' as $$
declare v digital_mais_private.ai_usage%rowtype;
begin
 if auth.uid() is null or not exists(select 1 from public.digital_mais_acessos a join public.funcionarios f on f.id=a.funcionario_id where a.user_id=auth.uid() and a.ativo and f.ativo) then raise exception 'Acesso não autorizado.' using errcode='42501'; end if;
 insert into digital_mais_private.ai_usage(user_id) values(auth.uid()) on conflict do nothing;
 select * into v from digital_mais_private.ai_usage where user_id=auth.uid() for update;
 if v.minute_start<now()-interval '1 minute' then v.minute_start:=now();v.minute_count:=0;end if;
 if v.day_start<current_date then v.day_start:=current_date;v.day_count:=0;end if;
 if v.minute_count>=5 or v.day_count>=100 then return false;end if;
 update digital_mais_private.ai_usage set minute_start=v.minute_start,minute_count=v.minute_count+1,day_start=v.day_start,day_count=v.day_count+1 where user_id=auth.uid();
 return true;
end $$;
revoke all on function digital_mais_private.take_ai_quota() from public,anon;
grant execute on function digital_mais_private.take_ai_quota() to authenticated;
create or replace function public.digital_mais_ai_quota() returns boolean language sql security invoker set search_path='' as $$ select digital_mais_private.take_ai_quota() $$;
revoke all on function public.digital_mais_ai_quota() from public,anon;
grant execute on function public.digital_mais_ai_quota() to authenticated;

-- Conta proprietária escolhida explicitamente pelo usuário nesta atualização.
-- Identificação por e-mail confirmado no cadastro existente, sem IDs gerados fixos.
update public.digital_mais_acessos a set papel='dono',ativo=true,decisao='aprovado'
from auth.users u where u.id=a.user_id and lower(u.email)='ingridiasmin99@gmail.com';
