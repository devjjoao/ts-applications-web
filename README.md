# Ts Applications

Portal em português para catálogo e gerenciamento de aplicações Discord. O projeto inclui login Discord OAuth2, dashboard do cliente, carrinho, renovações, administração, notificações, página pública de status e API Auth02.

## Sumário

- [Funcionalidades](#funcionalidades)
- [Limites atuais](#limites-atuais)
- [Requisitos e instalação](#requisitos-e-instalação)
- [Variáveis de ambiente](#variáveis-de-ambiente)
- [Configuração do Discord](#configuração-do-discord)
- [Administradores](#administradores)
- [Banco de dados JSON](#banco-de-dados-json)
- [Painel administrativo](#painel-administrativo)
- [Notificações](#notificações)
- [Status e incidentes](#status-e-incidentes)
- [Segurança](#segurança)
- [Referência das rotas](#referência-das-rotas)
- [Operação, backup e recuperação](#operação-backup-e-recuperação)
- [Testes](#testes)

## Funcionalidades

### Área pública

- Página inicial e catálogo de planos.
- Página institucional e documentos legais.
- FAQ pesquisável em `/faq`.
- Página de disponibilidade e incidentes em `/status`.
- Rotas amigáveis sem a extensão `.html`.

### Área do cliente

- Login com Discord OAuth2 e validação de `state`.
- Sessão persistente assinada em cookie `HttpOnly`.
- Dashboard isolada por usuário: um cliente não acessa aplicações de outro cliente.
- Configuração do token e ID do servidor.
- Ações de iniciar, parar e reiniciar.
- Carrinho, cupons e fluxo de renovação.
- Central de notificações exibida pelo sino no canto inferior direito.
- Avisos automáticos quando uma aplicação está próxima do vencimento.

### Administração

- Painel protegido em `/admin`.
- Indicadores de clientes, aplicações, pedidos pendentes, receita e notificações.
- Consulta e busca de clientes.
- Aprovação, cancelamento e reembolso manual de pedidos.
- Suspensão, reativação e extensão da validade de aplicações.
- Comunicados individuais ou para todos os clientes.
- Publicação e resolução de incidentes.
- Histórico de auditoria.

### Segurança

- Tokens novos criptografados com AES-256-GCM antes da gravação em JSON.
- Tokens nunca são enviados de volta pelas APIs do painel.
- Sessões persistidas em JSON e assinadas com HMAC.
- Rate limiting nas rotas de autenticação, administração e controle de aplicações.
- Validação de origem para métodos que alteram dados.
- Cabeçalhos contra framing, MIME sniffing e acesso desnecessário a recursos do navegador.
- Endereços IP mascarados nos registros de auditoria.
- Geolocalização por IP desativada por padrão.
- Escritas JSON atômicas e serializadas para reduzir risco de corrupção por concorrência.

## Limites atuais

O repositório não contém credenciais nem adaptadores de hospedagem ou pagamento. Portanto:

- Iniciar, parar e reiniciar altera o estado registrado no painel, mas ainda não controla um processo remoto.
- As rotas de pagamento PIX retornam HTTP `501` enquanto nenhum gateway estiver configurado.
- Aprovar um pedido no painel administrativo registra a aprovação, mas não substitui a confirmação assinada de um provedor de pagamento.
- A página de status monitora os componentes existentes no projeto; ela não monitora um provedor de hospedagem ainda não integrado.
- Não existe sistema de tickets. O atendimento individual continua sendo realizado pelo canal externo de suporte.

Antes de liberar o checkout em produção, conecte:

1. Um adaptador da hospedagem para criar, iniciar, parar, consultar e renovar aplicações.
2. Um gateway PIX com webhook assinado. Somente o webhook validado deve aprovar pagamentos automaticamente.

## Requisitos e instalação

- Node.js 18 ou superior.
- npm.
- Uma aplicação configurada no Discord Developer Portal.

No Windows:

```powershell
Copy-Item .env.example .env
npm install
npm start
```

Em desenvolvimento:

```powershell
npm run dev
```

O servidor utiliza a porta definida em `PORT`. Quando ela não estiver configurada, utiliza `3000`.

## Variáveis de ambiente

Crie o `.env` a partir do `.env.example`.

```dotenv
PUBLIC_URL=https://seu-dominio.com
DISCORD_CLIENT_ID=
DISCORD_CLIENT_SECRET=
SESSION_SECRET=
DATA_ENCRYPTION_KEY=
ADMIN_DISCORD_IDS=
ENABLE_IP_GEO=false
API_KEY=
ALLOW_FILE_FALLBACK=true
NODE_ENV=production
PORT=3000
TRUST_PROXY=false
```

| Variável                | Obrigatória     | Finalidade                                                                                                  |
| ----------------------- | --------------- | ----------------------------------------------------------------------------------------------------------- |
| `PUBLIC_URL`            | Sim             | URL pública sem barra final; usada nos callbacks OAuth2 e na validação de origem.                           |
| `DISCORD_CLIENT_ID`     | Sim             | ID da aplicação Discord utilizada pelo login do painel.                                                     |
| `DISCORD_CLIENT_SECRET` | Sim             | Segredo OAuth2 da aplicação Discord.                                                                        |
| `SESSION_SECRET`        | Sim             | Assina os identificadores de sessão. Use uma sequência longa e aleatória.                                   |
| `DATA_ENCRYPTION_KEY`   | Sim em produção | Chave usada na criptografia dos tokens gravados em JSON. Em desenvolvimento, o fallback é `SESSION_SECRET`. |
| `ADMIN_DISCORD_IDS`     | Não             | Lista de IDs Discord administrativos separados por vírgula.                                                 |
| `ENABLE_IP_GEO`         | Não             | Quando `true`, permite consulta aproximada de geolocalização no fluxo Auth02. O padrão é `false`.           |
| `API_KEY`               | Sim para Auth02 | Protege as rotas administrativas da API Auth02.                                                             |
| `ALLOW_FILE_FALLBACK`   | Não             | Quando diferente de `false`, usa `data/auth-v2.json` se o MySQL do Auth02 estiver indisponível.             |
| `NODE_ENV`              | Produção        | Use `production` para cookie `Secure` e bloqueio da aplicação de demonstração.                              |
| `PORT`                  | Não             | Porta HTTP; padrão `3000`.                                                                                  |
| `TRUST_PROXY`           | Não             | Use `true` somente atrás de um proxy reverso confiável. O padrão é `false`.                                 |
| `PLATFORM_DATA_FILE`    | Não             | Caminho alternativo para o JSON da plataforma, útil em testes e volumes dedicados.                          |

Também existem variáveis opcionais de MySQL para a API Auth02: `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_CONNECTION_LIMIT` e `DB_CONNECT_TIMEOUT`.

### Geração de segredos

Exemplo em Node.js:

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Gere valores diferentes para `SESSION_SECRET`, `DATA_ENCRYPTION_KEY` e `API_KEY`. Não versione o arquivo `.env`.

> Não altere `DATA_ENCRYPTION_KEY` depois de salvar tokens sem antes planejar uma migração. Tokens já criptografados dependem dessa chave.

## Configuração do Discord

No [Discord Developer Portal](https://discord.com/developers/applications):

1. Crie ou selecione a aplicação utilizada no login.
2. Em OAuth2, cadastre exatamente a URL de retorno:

```text
https://seu-dominio.com/api/auth/discord/callback
```

3. Preencha `PUBLIC_URL`, `DISCORD_CLIENT_ID` e `DISCORD_CLIENT_SECRET` no `.env`.
4. Em produção, utilize HTTPS e `NODE_ENV=production`.

Para desenvolvimento local, a URL normalmente é:

```text
http://localhost:3000/api/auth/discord/callback
```

`PUBLIC_URL`, a URL acessada pelo navegador e o callback cadastrado no Discord precisam representar o mesmo endereço público.

## Administradores

O acesso a `/admin` depende do ID do usuário autenticado no Discord. Existem duas formas de conceder acesso.

### Arquivo JSON

Edite `database/admins.json`:

```json
["123456789012345678", "987654321098765432"]
```

### Variável de ambiente

```dotenv
ADMIN_DISCORD_IDS=123456789012345678,987654321098765432
```

As duas listas são combinadas. Para revogar um administrador, remova o ID dos dois locais e reinicie o acesso do usuário. Nunca utilize nome de usuário como identificador de permissão, pois nomes podem ser alterados.

## Banco de dados JSON

As funcionalidades do portal, administração, notificações e status usam `data/platform.json`. O módulo `src/json-store.js` normaliza a estrutura, grava primeiro em arquivo temporário e depois realiza a substituição atômica.

Estrutura lógica:

```json
{
  "apps": {},
  "carts": {},
  "payments": {},
  "renewals": {},
  "sessions": {},
  "notifications": {},
  "auditLogs": [],
  "incidents": [],
  "statusChecks": [],
  "users": {}
}
```

| Campo           | Conteúdo                                                                         |
| --------------- | -------------------------------------------------------------------------------- |
| `apps`          | Aplicações por ID, proprietário, produto, validade, configuração e estado.       |
| `carts`         | Carrinhos e pedidos de contratação.                                              |
| `payments`      | Reserva para dados normalizados de pagamento.                                    |
| `renewals`      | Faturas e solicitações de renovação.                                             |
| `sessions`      | Sessões autenticadas, usuário e data de expiração.                               |
| `notifications` | Lista de notificações por ID Discord.                                            |
| `auditLogs`     | Últimos 2.000 eventos administrativos e de segurança.                            |
| `incidents`     | Incidentes publicados na página de status.                                       |
| `statusChecks`  | Amostras de disponibilidade dos últimos sete dias, limitadas a 10.080 registros. |
| `users`         | Perfil básico obtido no login Discord e data do último acesso.                   |

O Auth02 possui armazenamento separado. Quando o MySQL não estiver disponível e `ALLOW_FILE_FALLBACK=true`, utiliza `data/auth-v2.json` com as coleções `auth_bots` e `verified_users`.

### Regras para dados sensíveis

- Não coloque segredos em arquivos dentro de `database/`.
- Tokens de aplicação novos são salvos no formato criptografado `enc:v1:...`.
- Tokens e client secrets do Auth02 também são criptografados quando o armazenamento em arquivo está ativo.
- O backend remove tokens das respostas públicas do painel.
- O fallback Auth02 não grava IP bruto nem coordenadas exatas; mantém apenas dados necessários como IP mascarado e hash antifraude.

## Painel administrativo

Abra `/admin` depois de autenticar uma conta cujo ID esteja autorizado.

### Indicadores

- Total de clientes identificados por aplicações, pedidos ou login.
- Aplicações cadastradas e aplicações em execução.
- Pedidos com pagamento pendente.
- Receita calculada a partir de pedidos marcados como aprovados.
- Total de notificações ainda não lidas.

### Ações sobre aplicações

| Ação      | Resultado                                                                                                               |
| --------- | ----------------------------------------------------------------------------------------------------------------------- |
| Suspender | Marca a aplicação como suspensa, interrompe o estado de execução e impede novo início.                                  |
| Ativar    | Remove a suspensão.                                                                                                     |
| Prorrogar | Acrescenta a quantidade informada de dias à validade, limitada entre 1 e 365 dias por chamada. A interface usa 30 dias. |

Cada ação gera auditoria e uma notificação para o proprietário.

### Ações sobre pedidos

| Ação       | Estado resultante |
| ---------- | ----------------- |
| Aprovar    | `aprovado`        |
| Cancelar   | `cancelado`       |
| Reembolsar | `reembolsado`     |

Essas ações são administrativas e locais. Quando houver um gateway real, a confirmação automática deve partir exclusivamente do webhook validado.

O backend valida as transições: somente pedidos pendentes podem ser aprovados ou cancelados, e somente pedidos aprovados podem ser reembolsados.

### Auditoria

Cada registro possui data, responsável, ação, alvo, IP mascarado e detalhes sem campos reconhecidos como token, segredo, senha ou autorização. A lista é limitada aos 2.000 eventos mais recentes; o painel apresenta os 300 mais recentes.

## Notificações

Usuários autenticados veem um sino no canto inferior direito das páginas que carregam `public/js/site-guard.js`.

As notificações podem ser geradas por:

- Suspensão, reativação ou prorrogação de uma aplicação.
- Aprovação, cancelamento ou reembolso de pedido.
- Comunicado individual enviado pelo administrador.
- Comunicado geral para todos os clientes conhecidos.
- Proximidade do vencimento da aplicação.

Ao abrir o painel do sino, as notificações são marcadas como lidas. Cada usuário mantém no máximo 100 notificações.

Os avisos de vencimento são avaliados quando o usuário consulta a central. Eles começam nos sete dias anteriores ao vencimento e utilizam uma chave de deduplicação para evitar a repetição da mesma faixa diária.

## Status e incidentes

A página `/status` consulta `GET /api/status` a cada 60 segundos e apresenta:

- Estado geral do portal.
- Portal e API.
- Banco de dados JSON.
- Configuração do login Discord.
- Configuração de segurança.
- Uptime calculado com as amostras das últimas 24 horas.
- Latência observada na consulta.
- Incidentes ativos e resolvidos.

Estados gerais:

| Estado         | Significado                                                                  |
| -------------- | ---------------------------------------------------------------------------- |
| `operational`  | Todos os componentes locais estão operacionais e não há incidente ativo.     |
| `degraded`     | Algum componente está sem configuração completa ou existe incidente parcial. |
| `major_outage` | Existe incidente ativo com impacto `major`.                                  |

Administradores publicam incidentes na aba **Incidentes** do painel e podem marcá-los como resolvidos. A página pública mostra o histórico mais recente.

## Segurança

### Sessões

- O cookie `ts_session` contém um identificador aleatório e sua assinatura HMAC.
- O cookie é `HttpOnly`, `SameSite=Lax` e dura até sete dias.
- Em `NODE_ENV=production`, o cookie também recebe `Secure`.
- O conteúdo da sessão fica em `data/platform.json`, não no cookie.
- Logout remove a sessão do JSON e limpa o cookie.
- Sessões expiradas são removidas durante novos logins ou quando forem apresentadas ao servidor.

### Criptografia

`src/security.js` deriva uma chave de 256 bits e usa AES-256-GCM com IV aleatório e tag de autenticação. `DATA_ENCRYPTION_KEY` tem prioridade; sem ela, o sistema usa `SESSION_SECRET` e depois `API_KEY`.

Essa proteção depende do sigilo da chave e não substitui permissões adequadas no sistema de arquivos nem backups protegidos.

### Rate limiting

| Grupo                         | Limite atual                              |
| ----------------------------- | ----------------------------------------- |
| Login Discord                 | 20 requisições por minuto por IP e rota.  |
| Administração                 | 120 requisições por minuto por IP e rota. |
| Token e controle de aplicação | 30 requisições por minuto por IP e rota.  |

Os contadores são mantidos em memória e reiniciam junto com o processo.

### Validação de origem

Requisições `POST`, `PUT`, `PATCH` e `DELETE` com cabeçalho `Origin` precisam corresponder à origem de `PUBLIC_URL`. Clientes internos sem `Origin`, como webhooks de servidor, não são bloqueados por essa verificação e devem usar sua própria autenticação.

### Privacidade

- Auditoria armazena IP mascarado.
- O fallback JSON do Auth02 não armazena IP bruto nem coordenadas exatas.
- `ENABLE_IP_GEO=false` mantém a consulta externa de geolocalização desativada.
- A política pública está disponível em `/privacidade`.

## Referência das rotas

### Públicas

| Método | Rota                              | Finalidade                                |
| ------ | --------------------------------- | ----------------------------------------- |
| `GET`  | `/api/produtos`                   | Lista produtos.                           |
| `GET`  | `/api/servidores/lista`           | Lista comunidades configuradas.           |
| `GET`  | `/api/status`                     | Retorna componentes, uptime e incidentes. |
| `GET`  | `/health`, `/_health`, `/healthz` | Verificação simples do processo.          |
| `GET`  | `/health/db`                      | Verifica o armazenamento Auth02.          |

### Login e sessão

| Método | Rota                         | Finalidade                                                      |
| ------ | ---------------------------- | --------------------------------------------------------------- |
| `GET`  | `/api/auth/discord`          | Inicia o login OAuth2.                                          |
| `GET`  | `/api/auth/discord/callback` | Conclui o login e cria a sessão.                                |
| `GET`  | `/api/session`               | Retorna o usuário autenticado e informa se ele é administrador. |
| `POST` | `/api/session/logout`        | Encerra a sessão atual.                                         |

### Aplicações do cliente

Todas exigem sessão válida.

| Método | Rota                     | Finalidade                                            |
| ------ | ------------------------ | ----------------------------------------------------- |
| `GET`  | `/api/meus-bots`         | Lista somente as aplicações do usuário.               |
| `GET`  | `/api/bot/detalhes/:id`  | Retorna uma aplicação pertencente ao usuário.         |
| `GET`  | `/api/square/status/:id` | Retorna estado, configuração pendente e uptime local. |
| `POST` | `/api/square/token`      | Salva token criptografado e ID do servidor.           |
| `POST` | `/api/square/action`     | Executa `start`, `stop` ou `restart` no estado local. |
| `POST` | `/api/dev/demo-app`      | Cria uma aplicação de demonstração fora de produção.  |

Corpo para salvar a configuração:

```json
{
  "squareId": "id-da-aplicacao",
  "newToken": "token-do-bot",
  "serverId": "id-do-servidor"
}
```

Corpo para uma ação:

```json
{
  "squareId": "id-da-aplicacao",
  "action": "restart"
}
```

### Carrinho, pagamento e renovação

| Método | Rota                                  | Finalidade                                       |
| ------ | ------------------------------------- | ------------------------------------------------ |
| `POST` | `/api/carrinho`                       | Cria um carrinho.                                |
| `GET`  | `/api/carrinho/:id`                   | Consulta um carrinho do usuário.                 |
| `POST` | `/api/carrinho/aplicar-desconto`      | Aplica cupom ao carrinho pendente mais recente.  |
| `POST` | `/api/pagamento/pix`                  | Reservada para PIX; atualmente retorna `501`.    |
| `GET`  | `/api/pagamento/status/:id`           | Consulta o pagamento do carrinho.                |
| `GET`  | `/api/bot/renovacao-data/:id`         | Retorna dados necessários à renovação.           |
| `POST` | `/api/renovacao/carrinho`             | Cria uma fatura de renovação.                    |
| `GET`  | `/api/renovacao/fatura/:id`           | Consulta uma fatura do usuário.                  |
| `POST` | `/api/renovacao/aplicar-desconto`     | Aplica uma única vez um cupom à fatura pendente. |
| `POST` | `/api/renovacao/pagamento/pix`        | Reservada para PIX; atualmente retorna `501`.    |
| `GET`  | `/api/renovacao/pagamento/status/:id` | Consulta o estado da renovação.                  |

### Notificações

| Método | Rota                      | Finalidade                                   |
| ------ | ------------------------- | -------------------------------------------- |
| `GET`  | `/api/notifications`      | Lista notificações e total não lido.         |
| `POST` | `/api/notifications/read` | Marca uma notificação, ou todas, como lidas. |

Para marcar uma notificação específica:

```json
{ "id": "id-da-notificacao" }
```

Envie `{}` para marcar todas.

### Administração

Todas exigem sessão Discord e ID presente na lista de administradores.

| Método | Rota                               | Finalidade                                 |
| ------ | ---------------------------------- | ------------------------------------------ |
| `GET`  | `/api/admin/me`                    | Confirma a permissão administrativa.       |
| `GET`  | `/api/admin/overview`              | Retorna indicadores e estado geral.        |
| `GET`  | `/api/admin/customers?q=`          | Lista ou pesquisa clientes.                |
| `GET`  | `/api/admin/apps`                  | Lista aplicações sem expor tokens.         |
| `GET`  | `/api/admin/orders`                | Lista carrinhos e renovações.              |
| `GET`  | `/api/admin/audit`                 | Retorna os 300 eventos mais recentes.      |
| `POST` | `/api/admin/apps/:id/action`       | Suspende, ativa ou prorroga uma aplicação. |
| `POST` | `/api/admin/orders/:id/action`     | Aprova, cancela ou reembolsa um pedido.    |
| `POST` | `/api/admin/notifications`         | Envia comunicado individual ou geral.      |
| `POST` | `/api/admin/incidents`             | Publica um incidente.                      |
| `POST` | `/api/admin/incidents/:id/resolve` | Resolve um incidente.                      |

Exemplos de ações administrativas:

```json
{ "action": "suspend" }
```

```json
{ "action": "extend", "days": 30 }
```

```json
{ "action": "refund", "reason": "Solicitação do cliente" }
```

Comunicado individual:

```json
{
  "userId": "123456789012345678",
  "title": "Manutenção programada",
  "message": "Sua aplicação será reiniciada às 03:00.",
  "type": "info",
  "link": "/dashboard"
}
```

Para comunicar todos os clientes conhecidos, envie `"broadcast": true`.

### Auth02

As rotas abaixo usam `Authorization: Bearer <API_KEY>` quando indicado:

| Método | Rota                           | Proteção          | Finalidade                                            |
| ------ | ------------------------------ | ----------------- | ----------------------------------------------------- |
| `POST` | `/api/auth02/configurar`       | API key           | Cadastra token, client secret e configuração inicial. |
| `POST` | `/api/auth02/configurar-geral` | API key           | Atualiza servidor, cargo e webhook.                   |
| `GET`  | `/api/auth02/info/:botId`      | API key           | Retorna informações resumidas.                        |
| `GET`  | `/auth02/verify`               | OAuth2 state/code | Conclui a verificação Discord.                        |
| `POST` | `/api/auth02/pull`             | API key           | Adiciona usuários verificados a um servidor.          |

## Operação, backup e recuperação

### Backup

Pare o processo ou faça o backup em um momento sem escrita ativa. No PowerShell:

```powershell
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
New-Item -ItemType Directory -Force -Path backups | Out-Null
Copy-Item data/platform.json "backups/platform-$timestamp.json"
if (Test-Path data/auth-v2.json) { Copy-Item data/auth-v2.json "backups/auth-v2-$timestamp.json" }
```

Proteja também o `.env` em um cofre de segredos separado. O backup dos JSONs sem a chave de criptografia não permite recuperar tokens criptografados.

### Restauração

1. Pare o servidor.
2. Guarde uma cópia do arquivo atual.
3. Valide se o backup contém JSON válido.
4. Copie o backup escolhido para `data/platform.json`.
5. Restaure a mesma `DATA_ENCRYPTION_KEY` usada quando os tokens foram gravados.
6. Inicie o servidor e execute a verificação manual.

Validação de JSON:

```powershell
Get-Content data/platform.json -Raw | ConvertFrom-Json | Out-Null
```

### Retenção e limpeza

- Auditoria: o sistema mantém automaticamente os últimos 2.000 eventos.
- Notificações: até 100 por usuário.
- Amostras de status: últimos sete dias, até 10.080 registros.
- Sessões expiradas: removidas quando apresentadas ou durante um novo login.
- Incidentes: permanecem no histórico até manutenção manual do arquivo.

Não edite `data/platform.json` enquanto o servidor estiver gravando. Para ajustes operacionais comuns, utilize o painel administrativo.

## Testes

### Verificação de sintaxe

```powershell
npm run check
```

O comando verifica:

- `src/server.js`
- `src/platform.js`
- `src/json-store.js`
- `src/security.js`
- `src/db.js`
- Scripts externos em `public/js/` usados pelas páginas refatoradas.

### Testes automatizados

```powershell
npm test
```

A suíte sobe uma instância isolada com um JSON temporário e valida autorização administrativa, preços de renovação calculados no servidor, bloqueio de cupom duplicado, transições de pedidos e proteção de origem. Ela não altera `data/platform.json`.

### Padronização do código

```powershell
npm run format
npm run format:check
```

O projeto usa Prettier como dependência de desenvolvimento para manter os módulos, scripts externos e páginas principais legíveis e consistentes.

### Organização do frontend

- Cada página HTML possui um arquivo de estilos correspondente em `public/css/`, por exemplo `admin.html` usa `admin.css`.
- Estilos reutilizáveis de marca ficam em `public/css/shared.css`.
- As páginas não mantêm blocos `<style>` nem atributos `style` inline.
- Os scripts das páginas principais ficam em `public/js/`, evitando JavaScript inline e handlers `onclick`.

Os comandos abaixo existem para manutenção estrutural e são idempotentes:

```powershell
npm run extract:css
npm run normalize:styles
```

O primeiro move blocos de estilo encontrados em HTML para o CSS correspondente. O segundo normaliza estilos estáticos compartilhados e garante a inclusão de `shared.css`.

### Checklist manual

1. Abra `http://localhost:3000` e confirme as páginas públicas.
2. Acesse `/status` e confirme componentes, uptime e ausência/presença de incidentes.
3. Acesse `/faq` e teste a pesquisa.
4. Faça login com Discord.
5. Confirme que `/dashboard` mostra somente as aplicações do usuário.
6. Salve token e servidor e confirme que o token não aparece nas respostas da API.
7. Abra o sino, leia notificações e confirme que o contador desaparece.
8. Acesse `/admin` com uma conta autorizada.
9. Teste busca de clientes, suspensão/reativação de uma aplicação e comunicado individual.
10. Publique um incidente de teste, verifique `/status` e depois marque-o como resolvido.
11. Termine a sessão e confirme que páginas protegidas redirecionam para o login.

Em desenvolvimento, a dashboard permite criar uma aplicação de demonstração. Essa opção é bloqueada automaticamente quando `NODE_ENV=production`.

## Arquivos principais

| Arquivo                   | Responsabilidade                                                          |
| ------------------------- | ------------------------------------------------------------------------- |
| `src/server.js`           | Servidor Express, OAuth2, sessão, segurança HTTP e Auth02.                |
| `src/platform.js`         | APIs do cliente, administração, status e notificações.                    |
| `src/json-store.js`       | Leitura, normalização e escrita atômica de `platform.json`.               |
| `src/security.js`         | Criptografia, descriptografia e remoção de campos sensíveis da auditoria. |
| `src/db.js`               | Persistência MySQL/fallback JSON da API Auth02.                           |
| `public/admin.html`       | Interface administrativa.                                                 |
| `public/status.html`      | Interface pública de disponibilidade.                                     |
| `public/faq.html`         | Central de dúvidas pesquisável.                                           |
| `public/js/admin.js`      | Comportamento e renderização segura do painel administrativo.             |
| `public/js/dashboard.js`  | Carregamento e renderização segura das aplicações.                        |
| `public/js/conta.js`      | Perfil autenticado e menu da conta sem JavaScript inline.                 |
| `public/js/index.js`      | Comunidades, sessão pública e animação da página inicial.                 |
| `public/js/site-guard.js` | Sincronização da sessão, logout e central de notificações.                |
| `public/css/shared.css`   | Estilos reutilizáveis por todas as páginas.                               |
| `public/css/*.css`        | Estilos específicos de cada página HTML.                                  |
| `database/admins.json`    | IDs Discord autorizados a acessar a administração.                        |
| `data/platform.json`      | Estado persistente da plataforma.                                         |
| `tests/static.js`         | Impede scripts e handlers inline nas páginas refatoradas.                 |
| `tests/smoke.js`          | Exercita APIs críticas usando armazenamento JSON temporário.              |

## Produção

Antes de publicar:

- Use HTTPS.
- Defina `NODE_ENV=production`.
- Gere segredos fortes e diferentes.
- Restrinja permissões de leitura do `.env` e dos arquivos em `data/`.
- Configure backups automáticos e teste a restauração.
- Conecte o gateway de pagamento com webhook assinado.
- Conecte o adaptador real da hospedagem.
- Não publique `database/admins.json` com IDs administrativos indevidos.
- Mantenha `ENABLE_IP_GEO=false` se a geolocalização não for estritamente necessária e documentada para os usuários.

## Versionamento seguro

O `.gitignore` exclui dependências, `.env`, sessões, tokens, dados de clientes, transações, certificados privados, backups, logs, bancos locais e pacotes binários de produtos. Catálogo, cupons, comunidades, código-fonte, `package-lock.json` e arquivos de exemplo continuam versionáveis.

Use `database/admins.example.json` como modelo e mantenha os IDs administrativos reais apenas em `database/admins.json` ou `ADMIN_DISCORD_IDS`.

Se algum arquivo sensível já tiver sido commitado antes da criação do `.gitignore`, removê-lo do diretório não apaga o histórico do Git. Nesse caso, revogue os segredos expostos e faça a limpeza do histórico antes de publicar o repositório.
