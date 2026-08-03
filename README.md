# RFitness — Sistema de Gestão de Academia (SaaS)

Estoque com SKUs, PDV, financeiro, dashboard em tempo real, alunos e planos, pedidos e um
agente de IA no WhatsApp. Um único app Next.js, feito para rodar na **Vercel** com banco,
autenticação, storage e realtime no **Supabase**.

## Arquitetura

```
rfitness/
├── apps/web            # Next.js 15 (App Router) — UI + API (route handlers) + jobs (cron)
│   ├── src/app/api     # todas as rotas REST
│   ├── src/server      # camada de servidor: módulos, infra, http
│   └── src/components  # UI
├── packages/core       # regras de negócio puras, sem I/O (94 testes)
├── packages/db         # Prisma schema, migrations e seed
└── apps/web/vercel.json  # Cron Jobs (fica no Root Directory da Vercel)
```

Três camadas, com uma regra clara em cada:

| Camada | Papel | Depende de |
| --- | --- | --- |
| `packages/core` | cálculo e decisão: delta de estoque, totais de venda, máquina de estados do pedido, analytics, RBAC | nada |
| `apps/web/src/server/modules` | orquestração: services + repositórios Prisma por contexto | core + Prisma |
| `apps/web/src/app/api` | borda HTTP: sessão, RBAC, validação zod, tradução de erro | módulos |

`defineRoute` (`src/server/http/route.ts`) concentra o que antes eram guards, pipes e filtro
de exceção: sessão obrigatória por padrão (401), papel exigido (403), validação de
body/query/params com zod (400 com as issues) e `DomainError` → status HTTP. Erro inesperado
sempre vira 500 genérico — mensagem interna não vaza.

### Decisões que moldam o projeto

- **Sem servidor WebSocket.** Funções serverless não sustentam conexão longa. O servidor
  insere um sinal em `realtime_events`; o browser assina essa tabela via Supabase Realtime e
  reage refazendo a chamada REST, que aplica RBAC. O payload carrega só tipo e ids — nunca
  faturamento ou lucro.
- **Sem `@nestjs/schedule`.** Os jobs diários são Vercel Cron Jobs (`vercel.json`) batendo em
  `/api/cron/*`, autenticados por `CRON_SECRET`.
- **Supabase Auth é dono de credencial e sessão.** Só isso: quem é a pessoa. O vínculo com
  academia e os papéis vêm do banco (`users` + `user_roles`) a cada request — um metadata
  copiado do JWT seria uma segunda fonte de verdade fadada a divergir da tabela de papéis.
  Nenhuma rota aceita `gymId` do cliente.
- **Dois níveis, dois trabalhos.** O admin da plataforma faz CRUD de contas de gestor e de
  academias, e decide quem gerencia o quê. O gestor **não** cadastra unidade nem concede acesso:
  ele opera o dia a dia das academias que recebeu, e o seletor da topbar é o conjunto fechado do
  que ele alcança.
- **Cadastro cria a conta; a RFitness libera o acesso.** `/cadastro` pede nome, e-mail e senha
  — só isso. A conta nasce travada: até ser liberada, o login é recusado com o aviso na própria
  tela e o painel nem chega a renderizar (`/acesso-pendente`).
- **Um gestor, várias academias.** `users.authUserId` não é único — a pessoa tem um perfil por
  unidade, com papéis próprios em cada uma. A unidade ativa da sessão vem de um cookie que o
  servidor confronta com os vínculos reais, então trocar o cookie não troca de tenant.
- **RLS como segunda barreira.** Todas as tabelas de negócio têm RLS ligado **sem policy**:
  a anon key não lê nada direto. A única exceção é `realtime_events`, com SELECT escopado pela
  lista `app_metadata.gym_ids` do JWT — único lugar onde esse metadata ainda importa, porque a
  policy só enxerga o token.
- **Dinheiro nunca é float.** `Decimal(10,2)` no banco, `number` arredondado em centavos no
  core (`round2`/`sumMoney`), string ISO nas respostas.

## Rodando localmente

Requisitos: Node ≥20, pnpm 9, uma conta Supabase (ou a Supabase CLI para subir local).

```bash
pnpm install
cp .env.example .env            # preencha com as credenciais do seu projeto Supabase

pnpm db:generate                # gera o Prisma Client
pnpm db:migrate:deploy          # aplica as migrations no Supabase
pnpm db:seed                    # academia demo + admin no Supabase Auth + catálogo

pnpm dev                        # http://localhost:3000
```

Acessos da demo:

| Perfil             | Login                                          | Onde cai                |
| ------------------ | ---------------------------------------------- | ----------------------- |
| Gestor de academia | `admin@rfitness-demo.com` / `Rfitness@123`     | `/dashboard`            |
| Admin da RFitness  | `plataforma@rfitness.com` / `Plataforma@123`   | `/dashboard/plataforma` |

Sem projeto Supabase à mão, `docker compose --profile postgres up -d` sobe um Postgres cru —
suficiente para migrations e para o smoke de integração, mas **não** para login (Auth) nem
upload de foto (Storage).

### Scripts

| Comando | O que faz |
| --- | --- |
| `pnpm dev` / `pnpm build` / `pnpm start` | ciclo do Next |
| `pnpm test` | testes unitários (core + servidor), sem banco |
| `pnpm --filter @rfitness/web test:integration` | smoke de integração contra Postgres real (usa `DATABASE_URL`) |
| `pnpm typecheck` / `pnpm lint` | tipos e lint |
| `pnpm verify` | typecheck + lint + testes + build |
| `pnpm db:migrate` / `db:migrate:deploy` / `db:seed` / `db:studio` | banco |

## Deploy na Vercel

1. **Supabase** — crie o projeto e pegue em *Project Settings*:
   - `DATABASE_URL`: connection string do **pooler** (porta 6543) com
     `?pgbouncer=true&connection_limit=1` — é a que o runtime serverless usa;
   - `DIRECT_URL`: conexão direta (porta 5432), usada só por `prisma migrate`;
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
2. **Storage** — crie um bucket público (padrão: `rfitness-uploads`) para as fotos de SKU.
3. **Migrations** — `pnpm db:migrate:deploy` apontando para o projeto. A migration de RLS
   também adiciona `realtime_events` à publicação `supabase_realtime`; confirme em
   *Database → Replication* que a tabela está publicada.
4. **Vercel** — importe o repositório e defina **Root Directory: `apps/web`** (é onde está o
   `package.json` com o `next`; a Vercel detecta o framework por ele). Deixe *Include source
   files outside of the Root Directory* ligado, senão `packages/core` e `packages/db` não
   chegam ao build. Build e output ficam nos defaults do preset Next.js — `apps/web/package.json`
   já gera o Prisma Client antes do `next build`, e `apps/web/vercel.json` declara os Cron Jobs.
   Configure todas as variáveis do `.env.example` no projeto (inclusive `CRON_SECRET`).

   `vercel.json` também fixa `"regions": ["gru1"]` (São Paulo) — **mantenha isso alinhado com a
   região do seu projeto Supabase**. Na região padrão da Vercel (Washington) com o banco em
   `sa-east-1`, cada consulta ao Postgres atravessa o continente ida e volta, e são várias por
   request: é a diferença entre o painel abrir na hora e parecer travado. Depois do deploy dá
   para conferir em *Deployment → Functions*.
5. **WhatsApp (opcional)** — suba a Evolution API (`docker compose --profile whatsapp up -d`),
   aponte o webhook da instância para
   `https://<seu-app>/api/whatsapp/webhook?token=<EVOLUTION_API_KEY>` e salve o nome da
   instância em *Dashboard → WhatsApp*. Comece com `ANTHROPIC_MOCK_MODE=true` para testar o
   fluxo sem custo de API.

Cron Jobs configurados (horários em UTC, equivalentes a 06:00 e 10:00 em São Paulo):

| Rota | Agenda | O que faz |
| --- | --- | --- |
| `/api/cron/stock-alerts` | `0 9 * * *` | alertas de validade próxima, vencido e produto parado + limpeza de sinais antigos |
| `/api/cron/whatsapp-follow-up` | `0 13 * * *` | follow-up dos alunos matriculados há N dias |

## Agente de IA no WhatsApp

`src/server/modules/whatsapp/` — loop manual de tool use sobre o SDK da Anthropic, modelo
`claude-opus-5`. Três ferramentas: `search_product`, `check_membership_status` e
`create_order` (o único efeito colateral que o agente pode causar). O pensamento fica no
default adaptativo do modelo com `effort: "low"`, e recusa dos classificadores
(`stop_reason: "refusal"`) é tratada antes de ler o conteúdo, com encaminhamento para a
recepção. `ANTHROPIC_MOCK_MODE=true` responde sem chamar a API.

## Testes

```bash
pnpm test                                        # 198 testes unitários
pnpm --filter @rfitness/web test:integration     # 29 verificações contra Postgres real
```

Os unitários cobrem o core (regras puras) e os services (com repositórios falsos, sem banco).
O smoke de integração roda os services de verdade contra um Postgres real e verifica o que
teste unitário não alcança: transação de venda, baixa única na entrega do pedido, ausência de
baixa parcial quando a entrega falha, idempotência da receita no fluxo de caixa e o conteúdo
dos sinais de tempo real.

### Não validado neste ambiente

- Login, cadastro, aprovação e RLS **contra um projeto Supabase real** (o smoke usa
  Postgres cru, sem Auth/Realtime/Storage). O SQL da migration — inclusive `auth_gym_ids()`
  com claim ausente, vazio e malformado — foi exercitado no Postgres do compose.
- Upload de foto no Supabase Storage.
- Conversa real do agente no WhatsApp (sem instância Evolution nem chave Anthropic aqui).
- Leitura de código de barras pela câmera (`html5-qrcode`) — precisa de navegador real.

## Roadmap

Concluído: fundação, estoque, PDV, financeiro + tempo real, alunos, agente de WhatsApp,
pedidos. Pendente: **cobrança automática** (`Invoice`/`Payment`/`BillingRule` já no schema —
faltam os jobs e a integração de pagamento) e **relatórios + admin avançado** (exportação,
permissões granulares via `Permission`/`RolePermission`, gestão de funcionários).
