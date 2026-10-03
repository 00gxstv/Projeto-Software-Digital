# Configuração do Digital+ no Supabase

Projeto: digital-mais (squmrsfwoerqllnmussj).
Destino: https://projeto-tcc-institucional.vercel.app

## Ativar o banco
1. A responsável deve revisar e executar o conteúdo completo de migrations/20261003014305_conectar_digital_mais.sql no SQL Editor.
2. O script mantém as 13 tabelas e os registros existentes. Adiciona campos de prazo, pagamento, SKU, histórico e versão, uma lista de acessos autorizados e duas funções transacionais.
3. A política restritiva exige uma conta incluída em digital_mais_acessos para acessar as 13 tabelas. Contas autenticadas sem liberação deixam de ter acesso. Os membros do projeto continuam administrando pelo painel com suas permissões.
4. Confira a tabela lojas: devem existir as duas unidades com nome, endereço real e ativo = true. Não criamos endereços ou unidades fictícias.
5. Em Authentication > URL Configuration, configure Site URL como https://projeto-tcc-institucional.vercel.app e inclua estes Redirect URLs:
   - https://projeto-tcc-institucional.vercel.app/auth/callback
   - https://projeto-tcc-institucional.vercel.app/auth/callback?next=/redefinir-senha
6. Cadastre cada integrante no ERP publicado e confirme o e-mail. No mesmo navegador, abra os links de confirmação/recuperação (fluxo PKCE).
7. Execute liberar-acesso.sql, substituindo o e-mail, para cada integrante autorizado. O script cria um vínculo com funcionário; se já existir um funcionário correspondente, a responsável pode associar seu ID diretamente na tabela digital_mais_acessos.
8. Para revogar acesso, altere ativo para false em digital_mais_acessos. A RLS revalida essa tabela a cada operação.
9. Confira os avisos do Security Advisor antes de usar dados reais.

## Vercel
Configure NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY com os valores do Connect do digital-mais nos ambientes de destino. Nenhuma chave secreta/service_role é necessária. Faça novo deploy após configurar as variáveis.

O código está preparado em branch de integração. Só promover após aplicar o SQL e conferir o fluxo de login, liberação e cadastro no banco real.

## Verificação local
- npm ci
- node --test tests/supabase-integration.test.mjs
- npx tsc --noEmit
- npm run vercel-build

O teste usa PostgreSQL em WASM (PGlite), recria a estrutura exportada do banco e verifica RLS, operações atômicas, estoque entre unidades, devolução de peças, conflitos de versão e repetição segura do script. Não usa nem altera registros reais.

## Comportamento
- Login e recuperação por e-mail usam Supabase Auth. Contas da versão anterior que existiam só no cookie precisam ser criadas no Supabase.
- Clientes são compartilhados. OS e quantidades são filtradas pela unidade selecionada. Produtos e preços são comuns às duas lojas.
- As telas recarregam ao ganhar foco e a cada 30 segundos quando nenhum formulário está aberto.
- As escritas da aplicação passam por uma função com transação e bloqueios. Falhas revertem OS, itens e estoque juntos.
- A exclusão/cancelamento de OS devolve peças; os movimentos de estoque ficam registrados. Vínculos externos (ex.: mensagens) podem impedir exclusão; nesse caso use cancelamento.
- Não altere quantidades/itens diretamente no Table Editor durante atendimentos: as regras transacionais e versões são aplicadas pelo RPC do ERP.
- Os dados antigos do localStorage permanecem intactos, com opção de baixar cópia. Não são enviados automaticamente para evitar duplicação e mistura entre lojas.
- Recuperação/confirmacão depende da configuração de e-mail do Supabase. Se o envio padrão restringir destinatários ou atingir limite, configure SMTP próprio pelo painel.
- Transferências, fornecedores e WhatsApp não ganharam telas novas nesta integração; suas tabelas existentes foram preservadas.
