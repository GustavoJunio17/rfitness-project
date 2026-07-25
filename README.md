# RFitness — Sistema de Gestão de Academia (SaaS)

Sistema completo de gestão para academias: estoque, vendas, financeiro, dashboard em
tempo real, agente de IA no WhatsApp, pedidos, alunos, cobrança automática e relatórios.

Este repositório é desenvolvido **de forma incremental, por fases** (veja
[Roadmap](#roadmap)). Cada fase é funcional e revisável de ponta a ponta antes de
avançar para a próxima.

## Status atual: Fase 7 — Pedidos via WhatsApp

**Fase 1 — Fundação** (concluída):
- Monorepo (pnpm workspaces + Turborepo)
- Banco de dados PostgreSQL modelado por completo via Prisma (todos os domínios do
  sistema, normalizado, com FKs e índices) — migration inicial já gerada
- API NestJS em Clean Architecture/DDD (domain → application → infrastructure →
  interface), com Swagger, validação, rate limiting, Helmet e CORS
- Módulo **Identity/Auth** funcional: cadastro de academia (tenant), login, JWT +
  refresh token com rotação, RBAC por papéis, auditoria automática
- Módulo **Audit Log** com interceptor global
- Frontend Next.js com branding RFitness (vermelho/preto/branco), tela de login real
  contra a API, layout de dashboard protegido (guard de rota + shell com sidebar),
  dark mode
- Docker Compose para Postgres/Redis (+ perfis opcionais para Evolution API e build
  completo da API/Web)

**Fase 2 — Controle de Estoque** (concluída):
- Módulo **catalog**: categorias, marcas, fornecedores (CRUD); produtos com múltiplos
  SKUs (`ProductVariant`) por marca/sabor/peso, geração automática de SKU, geração de
  **QR Code** por SKU, busca por **código de barras**, upload de foto por SKU (adapter
  local em dev / Supabase Storage em produção, via `STORAGE_DRIVER`)
- Módulo **inventory**: registro de movimentações (entrada, saída, venda, troca,
  perda, validade, ajuste de inventário) com atualização atômica do estoque; alerta
  automático de **estoque baixo** reavaliado a cada movimentação; job diário
  (`@nestjs/schedule`) para alertas de **validade próxima**, **vencido** e
  **produto parado**
- UI de estoque (`/dashboard/estoque`): listagem de SKUs com busca/filtro, cadastro de
  produto com SKUs, registro de movimentação, painel de alertas, leitura de código de
  barras pela câmera (`html5-qrcode`) e visualização de QR Code
- Testes unitários cobrindo a regra de sinal por tipo de movimentação e a lógica de
  alerta de estoque baixo; e2e cobrindo produto → SKU → movimentação → alerta

**Fase 3 — Vendas (PDV)** (concluída):
- Módulo **sales**: registra venda (cliente opcional, itens, forma de pagamento,
  desconto) em **uma única transação** — cria `Sale`+`SaleItem[]`, um `StockMovement`
  tipo `SALE` por SKU e já decrementa `ProductVariant.currentQuantity`, tudo atômico
- Preço e custo do SKU são copiados para `SaleItem` no momento da venda (snapshot —
  histórico não muda se o preço do produto for alterado depois)
- Itens duplicados do mesmo SKU no carrinho são somados antes de validar estoque;
  venda é rejeitada (400) se o estoque for insuficiente ou o desconto exceder o
  subtotal
- Reaproveita a regra de alerta de estoque baixo da Fase 2 (extraída para
  `LowStockAlertService`, compartilhada entre `inventory` e `sales`) — uma venda que
  derruba o estoque abaixo do mínimo dispara o mesmo alerta `LOW_STOCK`
- UI de PDV (`/dashboard/vendas`): busca de produto/SKU, leitura de código de barras
  (reaproveitando o scanner da Fase 2), carrinho editável, forma de pagamento,
  desconto, totais calculados, histórico de vendas
- Testes unitários cobrindo fusão de itens, cálculo de total/lucro com e sem desconto,
  estoque insuficiente e desconto inválido; e2e cobrindo produto → venda → baixa de
  estoque → movimentação `SALE`

**Fase 4 — Financeiro + Dashboard em Tempo Real** (concluída):
- Infraestrutura de **realtime** (`apps/api/src/shared/realtime/`): gateway Socket.io
  autenticado por JWT no handshake, rooms por academia (`gym:<gymId>`) — nenhum evento
  vaza entre tenants. Os eventos carregam só um **sinal** (tipo + ids), nunca valores
  de faturamento/lucro: o frontend reage invalidando queries do React Query e
  refazendo a chamada REST normal, que já aplica RBAC
- Módulo **finance**: receita/lucro hoje/semana/mês/ano, ticket médio, receita total,
  produtos mais/menos vendidos, formas de pagamento, heatmap de vendas por dia×hora,
  valor de estoque/investido/lucro esperado, contagem de estoque baixo/em falta;
  **receita prevista** é uma projeção aritmética simples (mês até hoje ÷ dias
  decorridos × dias no mês) — não é IA preditiva
- **Fluxo de caixa**: toda venda gera uma entrada automática (categoria "venda");
  lançamentos manuais (ex.: aluguel) via `/dashboard/financeiro`
- Todo o módulo `finance` é restrito a `@Roles('ADMIN','FINANCE')` — dados de
  lucro/custo não ficam visíveis para Recepção/Estoquista
- `/dashboard/dashboard` reescrito com cards reais (faturamento, lucro, ticket médio,
  valor de estoque, produtos em falta) + gráfico de receita, atualizando sozinho via
  Socket.io após uma venda; `/dashboard/financeiro` com gráficos (linha, barra, pizza,
  heatmap) e fluxo de caixa
- Testes unitários cobrindo os cálculos de `FinanceAnalyticsService`/`CashFlowService`;
  e2e cobrindo venda → resumo financeiro refletindo a receita → entrada automática no
  fluxo de caixa

**Fase 5 — Gestão de Alunos** (concluída):
- Módulo **students**: planos (`Plan`), alunos (`Student`) com CPF/telefone/WhatsApp/
  metas/observações, matrícula (`StudentSubscription`) vinculando aluno a plano com
  vencimento calculado a partir da duração do plano
- **Painel administrativo apenas** — o aluno não tem login nem portal; toda a
  interação dele com a academia acontece exclusivamente pelo agente de IA no WhatsApp
  (Fase 6). Isso não é uma limitação temporária, é uma decisão de escopo do produto
  (ver nota no Roadmap)
- Dashboard e PDV passam a usar dados reais de alunos: cards "clientes ativos"/"novos
  alunos no mês" e cliente opcional na venda (`/dashboard/vendas`)
- Cadastro de aluno emite um evento interno (`student.created`, via
  `@nestjs/event-emitter`) consumido pela Fase 6 para disparar a mensagem de
  boas-vindas — desacoplado para não criar dependência circular entre os módulos
- UI `/dashboard/alunos`: listagem com busca/filtro por status, cadastro de aluno e
  plano, matrícula, metas e observações
- Testes unitários cobrindo o CRUD de alunos/matrícula/metas; e2e cobrindo cadastro →
  matrícula → aparição nos indicadores do dashboard

**Fase 6 — Agente de IA no WhatsApp** (concluída):
- Integração com **Evolution API** (self-hosted, `EvolutionApiAdapter`) para envio de
  mensagens, e um webhook público (`POST /whatsapp/webhook?token=...`) que recebe
  mensagens recebidas — protegido por um segredo compartilhado (falha fechado: sem
  segredo configurado, sempre 401)
- **Agente conversacional com Claude** (`ClaudeAgentService`): loop manual de
  tool-use (sem depender do Tool Runner beta) com ferramentas para consultar
  produtos/preços/estoque, status de matrícula do aluno e criar pedidos
  (`create_order`, ligado na Fase 7)
- Histórico de conversa por telefone (`Conversation`/`Message`), vínculo automático
  com o cadastro do aluno quando o telefone bate
- **Boas-vindas automáticas** ao matricular um aluno (reage ao evento `student.created`
  da Fase 5) e **job diário de follow-up** (`@nestjs/schedule`) perguntando como está
  o treino N dias após a matrícula
- UI `/dashboard/whatsapp`: caixa de entrada com lista de conversas e histórico de
  mensagens, configuração do nome da instância Evolution API (`PATCH
  /whatsapp/settings`, `ADMIN`)
- Testes unitários cobrindo o loop de tool-use do `ClaudeAgentService` (resposta
  final, chamada de ferramenta, limite de turnos, erro de ferramenta reportado e não
  lançado) e o roteamento de mensagens do `WhatsAppAgentService`; e2e cobrindo
  autenticação do webhook e configurações administrativas
- **Não testado nesta máquina** (sem instância real da Evolution API nem chave da
  Anthropic): o caminho feliz completo de uma conversa real pelo WhatsApp

**Fase 7 — Pedidos via WhatsApp** (concluída):
- Módulo **orders**: pedido com itens/forma de pagamento/tipo de entrega, numeração
  sequencial por academia, máquina de estados
  `PENDING → SEPARATING → OUT_FOR_DELIVERY → DELIVERED` (mais `CANCELLED` a partir de
  qualquer estado não-terminal), com histórico de status
- **Estoque só é baixado quando o pedido chega a `DELIVERED`** (na criação é só uma
  checagem de disponibilidade) — reaproveita o mesmo `InventoryService.registerMovement`
  da Fase 2, então o alerta de estoque baixo e o realtime de movimentação já disparam
  automaticamente
- Ferramenta `create_order` no agente de IA (Fase 6): o cliente pode fechar um pedido
  direto pelo WhatsApp, o agente confirma itens/pagamento/entrega antes de criar
- Módulo **notifications** (leaf module, sem dependência de outros módulos de negócio):
  notificação em banco para novo pedido, novo aluno e estoque baixo, com evento
  realtime `notification.created`; sino no topbar (`/dashboard`) com contador de não
  lidas e lista com marcação de leitura
- Card "Pedidos pendentes" no dashboard ligado a `GET /orders/open-count` (dado real,
  não mais placeholder)
- UI `/dashboard/pedidos`: criação manual de pedido (mesmo padrão de carrinho do PDV),
  filtro por status, detalhe do pedido com histórico e botões de transição de status
- Testes unitários cobrindo criação (fusão de itens, estoque insuficiente, SKU de outra
  academia), transições de status válidas/inválidas e baixa de estoque só no
  `DELIVERED`; e2e cobrindo produto → pedido → transições → baixa de estoque na
  entrega → bloqueio de transições inválidas

Todos os demais módulos (cobrança automática, relatórios) têm o **schema de banco já
modelado** mas ainda **sem endpoints/UI** — cada um será implementado em sua própria
fase (veja Roadmap).

## Stack

| Camada        | Tecnologia                                             |
|---------------|---------------------------------------------------------|
| Frontend      | Next.js 14 (App Router), React, TypeScript, TailwindCSS, componentes estilo shadcn/ui, React Query, Zustand |
| Backend       | NestJS (TypeScript), Clean Architecture + DDD           |
| Banco         | PostgreSQL + Prisma ORM                                  |
| Cache/Filas   | Redis (BullMQ a partir da Fase 8 — cobrança automática)  |
| Realtime      | Socket.io (rooms por academia, autenticado por JWT)      |
| Auth          | JWT (access token) + Refresh Token opaco com rotação e revogação |
| WhatsApp      | Evolution API (self-hosted)                              |
| LLM           | Claude (Anthropic)                                        |
| Storage       | Supabase Storage (S3-compatible)                          |
| Pagamentos    | Mercado Pago (Pix/cartão/boleto)                          |

## Estrutura do repositório

```
rfitness/
├── apps/
│   ├── api/     # NestJS — módulos em domain/application/infrastructure/interface
│   └── web/     # Next.js — App Router, componentes ui/, store Zustand, api-client
├── packages/
│   └── database/  # Schema Prisma completo + migrations + seed
└── docker-compose.yml
```

## Como rodar localmente

Pré-requisitos: Node.js 20+, pnpm (`npm i -g pnpm` ou `corepack enable`), Docker (para
Postgres/Redis).

```bash
# 1. Instalar dependências
pnpm install

# 2. Configurar variáveis de ambiente
cp .env.example .env
# edite .env se necessário (os defaults já funcionam para dev local)

# 3. Subir Postgres + Redis
docker compose up -d postgres redis

# 4. Aplicar migrations e popular dados de demonstração
pnpm --filter @rfitness/database db:migrate:deploy   # aplica a migration já versionada
pnpm --filter @rfitness/database db:seed             # cria academia demo + admin

# 5. Subir a API (http://localhost:3001/api — Swagger em /api/docs)
pnpm --filter @rfitness/api start:dev

# 6. Em outro terminal, subir o frontend (http://localhost:3000)
pnpm --filter @rfitness/web dev
```

Login de demonstração (após o seed): academia `rfitness-demo`, e-mail
`admin@rfitness-demo.com`, senha `Rfitness@123`.

> Se preferir criar as migrations do zero (ambiente sem histórico), use
> `pnpm --filter @rfitness/database db:migrate` (modo interativo `migrate dev`) em vez
> de `db:migrate:deploy`.

### Testes

```bash
pnpm --filter @rfitness/api test        # unitários (não precisam de banco)
pnpm --filter @rfitness/api test:e2e    # e2e (precisa do Postgres rodando e migrado)
```

### Upload de fotos dos produtos

Por padrão (`STORAGE_DRIVER=local`) as fotos são salvas em `apps/api/uploads/` e
servidas em `http://localhost:3001/uploads/...` — funciona sem nenhuma credencial.
Para produção, defina `STORAGE_DRIVER=supabase` e preencha `SUPABASE_URL`,
`SUPABASE_SERVICE_ROLE_KEY` e `SUPABASE_STORAGE_BUCKET` no `.env`.

### Leitura de código de barras pela câmera

O botão "Ler código de barras" na tela de Estoque usa `html5-qrcode` (acesso à câmera
via `getUserMedia`). Isso não pôde ser testado neste ambiente de desenvolvimento
(sandboxed, sem navegador/câmera) — verifique manualmente em um navegador real antes
de considerar essa funcionalidade validada.

### Conexão em tempo real (Socket.io)

O frontend conecta automaticamente ao WebSocket da API assim que o usuário faz login
(`apps/web/src/lib/socket.ts`), autenticando com o access token atual. A conexão entra
na room da academia do usuário; qualquer venda ou alerta de estoque nessa academia
dispara um refetch automático dos dados do dashboard/estoque via React Query — não é
necessário recarregar a página. Não pôde ser testado neste ambiente por falta de
navegador; verifique abrindo duas abas logadas na mesma academia e registrando uma
venda em uma delas.

### Docker Compose — perfis opcionais

- `docker compose --profile whatsapp up -d` — sobe também a Evolution API (usada a
  partir da Fase 6)
- `docker compose --profile full up -d --build` — builda e sobe API e Web em modo
  produção dentro de containers (o dia a dia de desenvolvimento usa `pnpm dev`/
  `start:dev`, que é mais rápido)

## Arquitetura

Cada módulo de negócio no backend segue Clean Architecture:

```
modules/<contexto>/
├── domain/            # interfaces de repositório, tipos de domínio — sem dependência de framework
├── application/        # casos de uso (services) e DTOs, orquestram o domínio
├── infrastructure/      # implementações Prisma das interfaces do domain
└── interface/           # controllers HTTP, guards, strategies
```

Isso mantém as regras de negócio isoladas de detalhes de banco/HTTP e é o padrão que
todos os módulos futuros (estoque, vendas, financeiro, etc.) vão seguir.

Autenticação: guard JWT global (`APP_GUARD`) protege todas as rotas por padrão — use
`@Public()` para liberar uma rota e `@Roles('ADMIN', ...)` para restringir por papel.
Toda mutação autenticada é logada automaticamente em `audit_logs` por um interceptor
global; eventos pré-autenticação (login, registro) são logados explicitamente pelo
`AuthService`.

## Roadmap

1. **Fundação** (concluída) — monorepo, banco completo, auth, esqueleto do frontend
2. **Estoque completo** (concluída) — produtos, SKUs por marca/sabor/peso,
   movimentações, alertas, código de barras/QR
3. **Vendas (PDV)** (concluída) — baixa automática de estoque, cálculo de lucro
4. **Financeiro + Dashboard em tempo real** (concluída) — Socket.io, gráficos, fluxo
   de caixa
5. **Gestão de alunos** (concluída) — painel administrativo (cadastro, planos,
   matrículas, metas, histórico; **sem** login/portal para o aluno, ver nota abaixo)
6. **Agente de IA no WhatsApp** (concluída) — Evolution API + Claude, boas-vindas,
   follow-up, FAQ
7. **Pedidos via WhatsApp** (concluída) — aba de pedidos, baixa de estoque na entrega,
   notificações
8. Cobrança automática (jobs agendados via BullMQ, regras configuráveis de dias)
9. Relatórios (PDF/Excel/CSV) + Admin avançado (permissões granulares, integrações)

> **Decisão de escopo**: o aluno não tem login nem portal web/mobile no RFitness. Toda
> interação do aluno com a academia acontece pelo WhatsApp, onde o agente de IA (Fase
> 6) extrai o que for necessário (dúvidas sobre plano, atualização de metas, pedidos).
> A Fase 5 é só o painel administrativo — quem usa é a equipe da academia, não o aluno.

## Nota sobre o ambiente de desenvolvimento

Fases 1 a 7 foram validadas nesta máquina com: `pnpm install`, geração do Prisma
Client, build da API e do Web (`pnpm build`, via Turborepo), lint de ambos e a suíte de
testes unitários da API — todos passando (9 suítes, 61 testes). O ambiente onde este
código foi gerado não tem Docker/Postgres, navegador, instância real da Evolution API
nem chave da Anthropic disponíveis, então **não foi possível rodar**:
- os testes e2e (todos escritos e revisados quanto a erros de compilação/DI —
  inclusive um bug real de DI encontrado e corrigido dessa forma, ver abaixo — mas não
  executados contra um banco real);
- aplicar as migrations num banco real;
- testar pela UI os fluxos completos (venda pelo PDV/pedido pelo painel → dashboard
  atualizando sozinho via Socket.io, sino de notificações recebendo em tempo real);
- o scanner de código de barras pela câmera e a conexão WebSocket de fato;
- o caminho feliz de uma conversa real do agente de IA pelo WhatsApp (Fases 6 e 7),
  incluindo a ferramenta `create_order` sendo chamada por uma mensagem real do Claude.

Rode os comandos da seção "Como rodar localmente" para validar tudo isso na sua
máquina antes de seguir para a próxima fase.

Um bug real foi pego justamente por tentar rodar o teste e2e de pedidos sem banco: o
`OrdersModule` importava `InventoryModule` para usar `InventoryService`, mas esse
módulo só exportava `LowStockAlertService` — o Nest falhava ao resolver a dependência
antes mesmo de chegar na conexão com o Postgres. Corrigido adicionando
`InventoryService` aos `exports` de `InventoryModule`
(`apps/api/src/modules/inventory/inventory.module.ts`). Isso reforça que vale sempre
tentar rodar o e2e mesmo sem banco disponível — erros de wiring do Nest aparecem antes
do erro de conexão.

Também vale registrar uma limitação de cobertura: o RBAC do módulo `finance`
(`@Roles('ADMIN','FINANCE')`) só foi validado no e2e para o caminho **positivo**
(ADMIN acessando) e para o caminho não-autenticado (401) — não há ainda um endpoint de
gestão de usuários para criar um usuário RECEPTION/STOCKIST via API e testar o 403 de
ponta a ponta. Isso deve ser coberto quando a Fase 9 (Admin avançado) adicionar
convite/gestão de funcionários; por ora, a garantia de que o guard de papéis funciona
vem dos testes do próprio `RolesGuard`/`AuthService` da Fase 1.
