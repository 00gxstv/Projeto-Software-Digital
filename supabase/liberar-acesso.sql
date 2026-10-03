-- Executar SOMENTE no SQL Editor, pela responsável pelo projeto.
-- Primeiro a pessoa cria a conta no ERP e confirma o e-mail.
-- Troque apenas o e-mail abaixo. Não autoriza todos os cadastros automaticamente.
do $$
declare
  v_email text := 'SUBSTITUA_PELO_EMAIL_DA_PESSOA';
  v_user uuid;
  v_name text;
  v_func bigint;
begin
  select id, coalesce(nullif(raw_user_meta_data->>'name',''),split_part(email,'@',1))
    into v_user,v_name from auth.users where lower(email)=lower(trim(v_email)) and email_confirmed_at is not null;
  if v_user is null then raise exception 'Conta não encontrada ou e-mail ainda não confirmado.'; end if;
  select funcionario_id into v_func from public.digital_mais_acessos where user_id=v_user;
  if v_func is null then
    insert into public.funcionarios(nome) values(v_name) returning id into v_func;
  end if;
  insert into public.digital_mais_acessos(user_id,funcionario_id,ativo)
    values(v_user,v_func,true) on conflict(user_id) do update set ativo=true;
  update public.funcionarios set ativo=true where id=v_func;
end $$;
