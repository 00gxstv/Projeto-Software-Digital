-- Integração do ERP Digital+ com as 13 tabelas existentes.
-- Execute este arquivo inteiro no SQL Editor como responsável pelo projeto.
-- Não apaga tabelas nem registros. Cadastros novos precisam de liberação explícita.
begin;

create table if not exists public.digital_mais_acessos (
  user_id uuid primary key references auth.users(id) on delete cascade,
  funcionario_id bigint not null references public.funcionarios(id),
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);
alter table public.digital_mais_acessos enable row level security;
revoke all on public.digital_mais_acessos from anon, authenticated;
grant select on public.digital_mais_acessos to authenticated;
drop policy if exists acesso_proprio on public.digital_mais_acessos;
create policy acesso_proprio on public.digital_mais_acessos for select to authenticated using (user_id = (select auth.uid()));

-- A política RESTRICTIVE também limita as políticas permissivas que já existiam.
do $$
declare t text;
begin
  foreach t in array array['aparelhos','clientes','estoque','fornecedores','funcionarios','itens_ordem_servico','itens_transferencia','lojas','mensagens_whatsapp','movimentacoes_estoque','ordens_servico','produtos','transferencias'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('revoke truncate, references, trigger on public.%I from authenticated', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('drop policy if exists digital_mais_somente_equipe on public.%I', t);
    execute format('create policy digital_mais_somente_equipe on public.%I as restrictive for all to authenticated using (exists (select 1 from public.digital_mais_acessos a where a.user_id = (select auth.uid()) and a.ativo)) with check (exists (select 1 from public.digital_mais_acessos a where a.user_id = (select auth.uid()) and a.ativo))', t);
  end loop;
end $$;

alter table public.clientes add column if not exists versao integer not null default 1;
alter table public.produtos add column if not exists sku text;
alter table public.produtos add column if not exists versao integer not null default 1;
alter table public.estoque add column if not exists versao integer not null default 1;
alter table public.estoque add column if not exists ativo boolean not null default true;
alter table public.ordens_servico add column if not exists versao integer not null default 1;
alter table public.ordens_servico add column if not exists prazo_entrega date;
alter table public.ordens_servico add column if not exists forma_pagamento text not null default 'A definir';
alter table public.ordens_servico add column if not exists situacao_pagamento text not null default 'Pendente';
alter table public.ordens_servico add column if not exists tecnico_nome text;
alter table public.ordens_servico add column if not exists aguardando_peca boolean not null default false;
alter table public.ordens_servico add column if not exists historico jsonb not null default '[]'::jsonb;
alter table public.ordens_servico add column if not exists atualizado_em timestamptz not null default now();

create index if not exists digital_mais_os_loja on public.ordens_servico(loja_id, criado_em desc);
create index if not exists digital_mais_itens_os on public.itens_ordem_servico(ordem_servico_id);
create index if not exists digital_mais_mov_os on public.movimentacoes_estoque(ordem_servico_id);
create index if not exists digital_mais_aparelho_cliente on public.aparelhos(cliente_id);

create or replace function public.digital_mais_snapshot(p_loja_id bigint default null)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_loja bigint; v_result jsonb;
begin
  if not exists(select 1 from public.digital_mais_acessos where user_id = auth.uid() and ativo) then
    raise exception 'Acesso ainda não liberado pela equipe.' using errcode = '42501';
  end if;
  select id into v_loja from public.lojas where ativo and (p_loja_id is null or id = p_loja_id) order by id limit 1;
  if p_loja_id is not null and v_loja is null then raise exception 'Loja não encontrada ou inativa.'; end if;
  select jsonb_build_object(
    'storeId', v_loja::text,
    'stores', coalesce((select jsonb_agg(jsonb_build_object('id', id::text, 'name', nome) order by id) from public.lojas where ativo), '[]'::jsonb),
    'clients', coalesce((select jsonb_agg(jsonb_build_object('id', id::text,'name',nome,'phone',telefone,'email',coalesce(email,''),'document',coalesce(cpf,''),'createdAt',criado_em,'version',versao) order by id desc) from public.clientes), '[]'::jsonb),
    'stock', coalesce((select jsonb_agg(jsonb_build_object('id',p.id::text,'name',p.nome,'sku',coalesce(p.sku,''),'quantity',coalesce(e.quantidade,0),'minimum',coalesce(e.estoque_minimo,0),'cost',p.preco_custo,'price',p.preco_venda,'createdAt',p.criado_em,'version',coalesce(e.versao,0),'productVersion',p.versao) order by p.id desc) from public.produtos p left join public.estoque e on e.produto_id=p.id and e.loja_id=v_loja where p.ativo and coalesce(e.ativo,true) and v_loja is not null), '[]'::jsonb),
    'orders', coalesce((select jsonb_agg(jsonb_build_object(
      'id','OS-'||o.id,'clientId',o.cliente_id::text,'device',a.modelo,
      'service',o.defeito_relatado,'status',case when o.aguardando_peca and o.status='em_andamento' then 'Aguardando peça' else case o.status when 'aguardando_avaliacao' then 'Em análise' when 'aguardando_aprovacao' then 'Aguardando aprovação' when 'aprovado' then 'Aprovado' when 'em_andamento' then 'Em reparo' when 'concluido' then 'Pronto' when 'entregue' then 'Entregue' when 'cancelado' then 'Cancelado' end end,
      'technician',coalesce(o.tecnico_nome,f.nome),'dueDate',coalesce(o.prazo_entrega::text,''),
      'paymentMethod',o.forma_pagamento,'paymentStatus',o.situacao_pagamento,
      'notes',coalesce(o.observacoes,''),'history',o.historico,'version',o.versao,
      'value',o.valor_pecas+o.valor_mao_obra-o.desconto,'createdAt',o.criado_em,'updatedAt',o.atualizado_em,
      'parts',coalesce((select jsonb_agg(jsonb_build_object('stockItemId',i.produto_id::text,'name',p.nome,'quantity',i.quantidade,'unitPrice',i.valor_unitario) order by i.id) from public.itens_ordem_servico i join public.produtos p on p.id=i.produto_id where i.ordem_servico_id=o.id),'[]'::jsonb)
    ) order by o.id desc) from public.ordens_servico o join public.aparelhos a on a.id=o.aparelho_id join public.funcionarios f on f.id=o.funcionario_id where o.loja_id=v_loja), '[]'::jsonb)
  ) into v_result;
  return v_result;
end $$;

create or replace function public.digital_mais_mutate(p_action text, p_loja_id bigint, p_payload jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
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

  elsif p_action in ('saveOrder','status','deleteOrder') then
    if v_id is not null then
      select * into v_order from public.ordens_servico where id=v_id and loja_id=p_loja_id for update;
      if not found or v_order.versao<>v_version then raise exception 'Ordem alterada por outra pessoa. Atualize a página antes de salvar.'; end if;
    elsif p_action<>'saveOrder' then raise exception 'Ordem não encontrada.';
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
      if v_id is not null and v_order.cliente_id=v_client.id and exists(select 1 from public.aparelhos where id=v_order.aparelho_id and modelo=trim(p_payload->>'device')) then v_device:=v_order.aparelho_id;
      else
        insert into public.aparelhos(cliente_id,marca,modelo) values(v_client.id,'Não informada',trim(p_payload->>'device')) returning id into v_device;
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
      v_action:=case when v_order.id is null then 'Ordem criada' when p_action='status' then 'Status alterado para '||v_ui_status else 'Ordem atualizada: '||v_ui_status end;
      update public.ordens_servico set
        cliente_id=case when p_action='saveOrder' then v_client.id else cliente_id end,
        aparelho_id=case when p_action='saveOrder' then v_device else aparelho_id end,
        telefone_contato=case when p_action='saveOrder' then v_client.telefone else telefone_contato end,
        defeito_relatado=case when p_action='saveOrder' then trim(p_payload->>'service') else defeito_relatado end,
        tecnico_nome=case when p_action='saveOrder' then trim(p_payload->>'technician') else tecnico_nome end,
        prazo_entrega=case when p_action='saveOrder' then (p_payload->>'dueDate')::date else prazo_entrega end,
        forma_pagamento=case when p_action='saveOrder' then p_payload->>'paymentMethod' else forma_pagamento end,
        situacao_pagamento=case when p_action='saveOrder' then p_payload->>'paymentStatus' else situacao_pagamento end,
        observacoes=case when p_action='saveOrder' then nullif(trim(p_payload->>'notes'),'') else observacoes end,
        status=v_status, aguardando_peca=v_ui_status='Aguardando peça',
        valor_pecas=v_parts_total,valor_mao_obra=greatest(v_total-v_parts_total,0),desconto=greatest(v_parts_total-v_total,0),
        data_conclusao=case when v_status in ('concluido','entregue') then coalesce(data_conclusao,now()) else null end,
        data_entrega=case when v_status='entregue' then coalesce(data_entrega,now()) else null end,
        historico=historico||jsonb_build_array(jsonb_build_object('id',gen_random_uuid()::text,'at',now(),'action',v_action,'actorId',auth.uid())),
        atualizado_em=now(),versao=versao+1
      where id=v_id;
    end if;
  else raise exception 'Operação não reconhecida.';
  end if;
  return jsonb_build_object('ok',true,'id',v_id::text);
end $$;

revoke all on function public.digital_mais_snapshot(bigint) from public, anon;
revoke all on function public.digital_mais_mutate(text,bigint,jsonb) from public, anon;
grant execute on function public.digital_mais_snapshot(bigint) to authenticated;
grant execute on function public.digital_mais_mutate(text,bigint,jsonb) to authenticated;
notify pgrst, 'reload schema';
commit;
