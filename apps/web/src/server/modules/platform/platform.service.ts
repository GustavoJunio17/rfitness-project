import { conflictError, evaluatePassword, notFoundError, validationError } from "@rfitness/core";
import type { ManagerAccountStatus } from "@prisma/client";
import { prisma } from "../../db";
import { getSupabaseAdmin } from "../../supabase/admin";
import type { AuthContext } from "../../auth/context";
import { provisionGym, syncGymIdsMetadata, attachManagerToGym } from "../identity/gym-provisioning";

// =========================================================================
// Contas de gestor
// =========================================================================

export interface ManagerAccountDto {
  id: string;
  authUserId: string;
  name: string;
  email: string;
  phone: string | null;
  notes: string | null;
  status: ManagerAccountStatus;
  decisionReason: string | null;
  reviewedAt: Date | null;
  reviewerName: string | null;
  createdAt: Date;
  /** Academias que esta conta gerencia hoje. */
  gyms: { id: string; name: string; isOwner: boolean }[];
}

const ACCOUNT_SELECT = {
  id: true,
  authUserId: true,
  name: true,
  email: true,
  phone: true,
  notes: true,
  status: true,
  decisionReason: true,
  reviewedAt: true,
  createdAt: true,
  reviewedBy: { select: { name: true } },
} as const;

type AccountRow = {
  id: string;
  authUserId: string;
  name: string;
  email: string;
  phone: string | null;
  notes: string | null;
  status: ManagerAccountStatus;
  decisionReason: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
  reviewedBy: { name: string } | null;
};

/**
 * Anexa a cada conta as academias que ela gerencia.
 *
 * Uma consulta só para todas as contas em vez de uma por linha: a listagem do
 * console mostra dezenas, e o N+1 apareceria direto na tela.
 */
async function withGyms(accounts: AccountRow[]): Promise<ManagerAccountDto[]> {
  if (accounts.length === 0) return [];

  const authUserIds = accounts.map((account) => account.authUserId);
  const profiles = await prisma.user.findMany({
    where: { authUserId: { in: authUserIds } },
    select: {
      authUserId: true,
      gym: { select: { id: true, name: true, ownerAuthUserId: true } },
    },
    orderBy: { gym: { name: "asc" } },
  });

  const byAuthUser = new Map<string, ManagerAccountDto["gyms"]>();
  for (const profile of profiles) {
    const list = byAuthUser.get(profile.authUserId) ?? [];
    list.push({
      id: profile.gym.id,
      name: profile.gym.name,
      isOwner: profile.gym.ownerAuthUserId === profile.authUserId,
    });
    byAuthUser.set(profile.authUserId, list);
  }

  return accounts.map((account) => ({
    id: account.id,
    authUserId: account.authUserId,
    name: account.name,
    email: account.email,
    phone: account.phone,
    notes: account.notes,
    status: account.status,
    decisionReason: account.decisionReason,
    reviewedAt: account.reviewedAt,
    reviewerName: account.reviewedBy?.name ?? null,
    createdAt: account.createdAt,
    gyms: byAuthUser.get(account.authUserId) ?? [],
  }));
}

/** Envelope de listagem paginada. */
export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export async function listManagerAccounts(filter: {
  status?: ManagerAccountStatus;
  search?: string;
  page?: number;
  pageSize?: number;
}): Promise<Page<ManagerAccountDto>> {
  const page = Math.max(1, filter.page ?? 1);
  const pageSize = Math.min(100, Math.max(5, filter.pageSize ?? 20));

  const where = {
    ...(filter.status ? { status: filter.status } : {}),
    ...(filter.search
      ? {
          OR: [
            { name: { contains: filter.search, mode: "insensitive" as const } },
            { email: { contains: filter.search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [accounts, total] = await Promise.all([
    prisma.managerAccount.findMany({
      where,
      select: ACCOUNT_SELECT,
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.managerAccount.count({ where }),
  ]);

  return { items: await withGyms(accounts), total, page, pageSize };
}

/** Uma conta só, já com as academias — usada pela tela de detalhe. */
export async function getManagerAccount(id: string): Promise<ManagerAccountDto> {
  const account = await prisma.managerAccount.findUnique({ where: { id }, select: ACCOUNT_SELECT });
  if (!account) throw notFoundError("Conta não encontrada.");
  return (await withGyms([account]))[0]!;
}

async function getAccountOrThrow(id: string) {
  const account = await prisma.managerAccount.findUnique({ where: { id } });
  if (!account) throw notFoundError("Conta não encontrada.");
  return account;
}

async function requireReviewer(auth: AuthContext): Promise<{ id: string; name: string }> {
  const reviewer = await prisma.platformAdmin.findUnique({
    where: { authUserId: auth.authUserId },
    select: { id: true, name: true },
  });
  if (!reviewer) throw notFoundError("Admin de plataforma não encontrado.");
  return reviewer;
}

export interface CreateManagerAccountInput {
  name: string;
  email: string;
  password: string;
  phone?: string | null;
  notes?: string | null;
}

/**
 * Conta criada pelo admin da plataforma. Já nasce ACTIVE — quem a criou é
 * justamente quem liberaria, então deixá-la pendente da própria aprovação seria
 * um passo sem decisão.
 */
export async function createManagerAccount(
  auth: AuthContext,
  input: CreateManagerAccountInput,
): Promise<ManagerAccountDto> {
  const reviewer = await requireReviewer(auth);
  const email = input.email.trim().toLowerCase();
  const name = input.name.trim();

  const strength = evaluatePassword(input.password, [name, email]);
  if (!strength.acceptable) throw validationError(strength.hint ?? "Escolha uma senha mais forte.");

  const existing = await prisma.managerAccount.findUnique({ where: { email }, select: { id: true } });
  if (existing) throw conflictError("Já existe uma conta com este e-mail.");

  const { data, error } = await getSupabaseAdmin().auth.admin.createUser({
    email,
    password: input.password,
    email_confirm: true,
    app_metadata: { gym_ids: [] },
    user_metadata: { name },
  });

  if (error || !data.user) {
    if (/already been registered|already exists/i.test(error?.message ?? "")) {
      throw conflictError("Este e-mail já existe no Supabase Auth.");
    }
    throw validationError(`Não foi possível criar a conta: ${error?.message}`);
  }

  try {
    const account = await prisma.managerAccount.create({
      data: {
        authUserId: data.user.id,
        name,
        email,
        phone: input.phone?.trim() || null,
        notes: input.notes?.trim() || null,
        status: "ACTIVE",
        reviewedAt: new Date(),
        reviewedById: reviewer.id,
      },
      select: ACCOUNT_SELECT,
    });
    return (await withGyms([account]))[0]!;
  } catch (dbError) {
    // Sem o registro, sobraria uma credencial válida que o console não enxerga
    // — e o e-mail ficaria bloqueado para uma nova tentativa.
    await getSupabaseAdmin()
      .auth.admin.deleteUser(data.user.id)
      .catch(() => undefined);
    throw dbError;
  }
}

export interface UpdateManagerAccountInput {
  name?: string;
  phone?: string | null;
  notes?: string | null;
  status?: ManagerAccountStatus;
  decisionReason?: string | null;
}

/**
 * Edição e mudança de status da conta.
 *
 * A mudança de status reflete em `app_metadata.gym_ids`: suspender esvazia a
 * lista para o canal de tempo real calar junto, e reativar a reconstrói a partir
 * dos perfis. Sem isso a conta continuaria recebendo eventos das academias, mesmo
 * sem conseguir abrir o painel.
 */
export async function updateManagerAccount(
  auth: AuthContext,
  id: string,
  input: UpdateManagerAccountInput,
): Promise<ManagerAccountDto> {
  const reviewer = await requireReviewer(auth);
  const current = await getAccountOrThrow(id);

  const statusChanged = input.status !== undefined && input.status !== current.status;

  const account = await prisma.managerAccount.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.phone !== undefined ? { phone: input.phone?.trim() || null } : {}),
      ...(input.notes !== undefined ? { notes: input.notes?.trim() || null } : {}),
      ...(statusChanged
        ? {
            status: input.status,
            reviewedAt: new Date(),
            reviewedById: reviewer.id,
            decisionReason: input.decisionReason?.trim() || null,
          }
        : {}),
    },
    select: ACCOUNT_SELECT,
  });

  if (statusChanged) {
    if (input.status === "ACTIVE") {
      await syncGymIdsMetadata(current.authUserId);
    } else {
      await getSupabaseAdmin()
        .auth.admin.updateUserById(current.authUserId, { app_metadata: { gym_ids: [] } })
        .catch(() => undefined);
    }
  }

  return (await withGyms([account]))[0]!;
}

/** Define uma nova senha para a conta — o gestor pode trocá-la depois. */
export async function setManagerAccountPassword(
  auth: AuthContext,
  id: string,
  password: string,
): Promise<void> {
  await requireReviewer(auth);
  const account = await getAccountOrThrow(id);

  const strength = evaluatePassword(password, [account.name, account.email]);
  if (!strength.acceptable) throw validationError(strength.hint ?? "Escolha uma senha mais forte.");

  const { error } = await getSupabaseAdmin().auth.admin.updateUserById(account.authUserId, {
    password,
  });
  if (error) throw validationError(`Não foi possível definir a senha: ${error.message}`);
}

/**
 * Exclui a conta: perfis, registro e credencial.
 *
 * Recusa se a conta for dona de alguma academia. Apagar junto levaria alunos,
 * estoque e histórico financeiro de um tenant inteiro numa ação que o admin
 * pediu sobre uma *pessoa* — transferir ou excluir a academia primeiro é uma
 * decisão que tem que ser explícita.
 */
export async function deleteManagerAccount(auth: AuthContext, id: string): Promise<void> {
  await requireReviewer(auth);
  const account = await getAccountOrThrow(id);

  const owned = await prisma.gym.count({ where: { ownerAuthUserId: account.authUserId } });
  if (owned > 0) {
    throw conflictError(
      `Esta conta é dona de ${owned} academia(s). Transfira ou exclua essas academias antes de excluir a conta.`,
    );
  }

  await prisma.user.deleteMany({ where: { authUserId: account.authUserId } });
  await prisma.managerAccount.delete({ where: { id } });
  await getSupabaseAdmin()
    .auth.admin.deleteUser(account.authUserId)
    .catch(() => undefined);
}

// =========================================================================
// Cadastro público
// =========================================================================

export interface SignUpInput {
  requesterName: string;
  requesterEmail: string;
  password: string;
}

/**
 * Cadastro público de gestor: nome, e-mail e senha.
 *
 * Cria a conta de verdade, mas travada — sem liberação de um admin da
 * plataforma o login é recusado. A academia não é perguntada aqui de propósito;
 * quem decide quantas unidades existem é o gestor, depois de liberado.
 *
 * Ao contrário de um formulário anônimo, dizer "e-mail já cadastrado" é
 * necessário: a pessoa precisa saber que deve fazer login em vez de tentar de
 * novo.
 */
export async function signUp(input: SignUpInput): Promise<{ status: ManagerAccountStatus }> {
  const email = input.requesterEmail.trim().toLowerCase();
  const name = input.requesterName.trim();

  // Mesma regra de força do resto do sistema: o medidor da tela é conveniência,
  // não barreira — quem chama a API direto passa por aqui igual.
  const strength = evaluatePassword(input.password, [name, email]);
  if (!strength.acceptable) throw validationError(strength.hint ?? "Escolha uma senha mais forte.");

  const existing = await prisma.managerAccount.findUnique({ where: { email }, select: { status: true } });
  if (existing) {
    throw conflictError(
      existing.status === "REJECTED"
        ? "Este e-mail já teve um cadastro recusado. Fale com a administração da RFitness."
        : "Este e-mail já está cadastrado. Faça login.",
    );
  }

  const { data, error } = await getSupabaseAdmin().auth.admin.createUser({
    email,
    password: input.password,
    email_confirm: true,
    app_metadata: { gym_ids: [] },
    user_metadata: { name },
  });

  if (error || !data.user) {
    if (/already been registered|already exists/i.test(error?.message ?? "")) {
      throw conflictError("Este e-mail já está cadastrado. Faça login.");
    }
    throw validationError(`Não foi possível criar a conta: ${error?.message}`);
  }

  try {
    await prisma.managerAccount.create({ data: { authUserId: data.user.id, name, email } });
  } catch (dbError) {
    await getSupabaseAdmin()
      .auth.admin.deleteUser(data.user.id)
      .catch(() => undefined);
    throw dbError;
  }

  return { status: "PENDING" };
}

export interface AccountStatusDto {
  status: ManagerAccountStatus;
  decisionReason: string | null;
  createdAt: Date;
}

/** Situação da conta — é o que permite à interface explicar um painel travado. */
export async function getAccountStatus(authUserId: string): Promise<AccountStatusDto | null> {
  return prisma.managerAccount.findUnique({
    where: { authUserId },
    select: { status: true, decisionReason: true, createdAt: true },
  });
}

// =========================================================================
// Academias, do ponto de vista da plataforma
// =========================================================================

export interface PlatformGymDto {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  createdAt: Date;
  owner: { accountId: string | null; name: string; email: string } | null;
  managers: { accountId: string | null; name: string; email: string; isOwner: boolean }[];
  counts: { students: number; products: number; users: number };
}

const GYM_SELECT = {
  id: true,
  name: true,
  slug: true,
  isActive: true,
  createdAt: true,
  ownerAuthUserId: true,
  users: { select: { authUserId: true, name: true, email: true } },
  _count: { select: { students: true, products: true, users: true } },
} as const;

type GymRow = {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  createdAt: Date;
  ownerAuthUserId: string | null;
  users: { authUserId: string; name: string; email: string }[];
  _count: { students: number; products: number; users: number };
};

/**
 * Resolve os gestores de cada academia.
 *
 * O id da conta não vem do perfil — o perfil é por academia, a conta é da
 * pessoa. Uma consulta só faz o mapeamento de todos os gestores da página, em
 * vez de uma por linha.
 */
async function withManagers(gyms: GymRow[]): Promise<PlatformGymDto[]> {
  if (gyms.length === 0) return [];

  const authUserIds = [...new Set(gyms.flatMap((gym) => gym.users.map((user) => user.authUserId)))];
  const accounts = await prisma.managerAccount.findMany({
    where: { authUserId: { in: authUserIds } },
    select: { id: true, authUserId: true },
  });
  const accountIdByAuthUser = new Map(accounts.map((account) => [account.authUserId, account.id]));

  return gyms.map((gym) => {
    const managers = gym.users.map((user) => ({
      accountId: accountIdByAuthUser.get(user.authUserId) ?? null,
      name: user.name,
      email: user.email,
      isOwner: user.authUserId === gym.ownerAuthUserId,
    }));

    return {
      id: gym.id,
      name: gym.name,
      slug: gym.slug,
      isActive: gym.isActive,
      createdAt: gym.createdAt,
      owner: managers.find((manager) => manager.isOwner) ?? null,
      managers,
      counts: {
        students: gym._count.students,
        products: gym._count.products,
        users: gym._count.users,
      },
    };
  });
}

/**
 * Academias da plataforma, paginadas. Cadastro e volume apenas — faturamento e
 * dado de aluno continuam sendo do tenant, e admin de plataforma não é dono deles.
 */
export async function listPlatformGyms(filter: {
  search?: string;
  page?: number;
  pageSize?: number;
}): Promise<Page<PlatformGymDto>> {
  const page = Math.max(1, filter.page ?? 1);
  const pageSize = Math.min(100, Math.max(5, filter.pageSize ?? 20));

  const where = filter.search
    ? { name: { contains: filter.search, mode: "insensitive" as const } }
    : {};

  const [gyms, total] = await Promise.all([
    prisma.gym.findMany({
      where,
      select: GYM_SELECT,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.gym.count({ where }),
  ]);

  return { items: await withManagers(gyms), total, page, pageSize };
}

/** Uma academia só — usada pela tela de detalhe. */
export async function getPlatformGym(id: string): Promise<PlatformGymDto> {
  const gym = await prisma.gym.findUnique({ where: { id }, select: GYM_SELECT });
  if (!gym) throw notFoundError("Academia não encontrada.");
  return (await withManagers([gym]))[0]!;
}

/** Academias em forma de opção — o suficiente para montar seletores. */
export async function listGymOptions(): Promise<{ id: string; name: string; isActive: boolean }[]> {
  return prisma.gym.findMany({
    select: { id: true, name: true, isActive: true },
    orderBy: { name: "asc" },
  });
}

/**
 * Cria a academia. O dono é opcional — o admin cadastra a unidade e define
 * depois, no detalhe do gestor, quem tem acesso a ela.
 */
export async function createPlatformGym(
  auth: AuthContext,
  input: { name: string; ownerAccountId?: string | null },
): Promise<{ id: string }> {
  await requireReviewer(auth);

  let owner: { authUserId: string; name: string; email: string } | undefined;
  if (input.ownerAccountId) {
    const account = await getAccountOrThrow(input.ownerAccountId);
    if (account.status !== "ACTIVE") {
      throw conflictError("O gestor dono precisa estar com a conta ativa.");
    }
    owner = { authUserId: account.authUserId, name: account.name, email: account.email };
  }

  const gym = await provisionGym({ gymName: input.name, owner });
  if (owner) await syncGymIdsMetadata(owner.authUserId);

  return { id: gym.id };
}

export async function updatePlatformGym(
  auth: AuthContext,
  gymId: string,
  input: { name?: string; isActive?: boolean; ownerAccountId?: string },
): Promise<void> {
  await requireReviewer(auth);

  const gym = await prisma.gym.findUnique({
    where: { id: gymId },
    select: { id: true, ownerAuthUserId: true },
  });
  if (!gym) throw notFoundError("Academia não encontrada.");

  let newOwnerAuthUserId: string | undefined;
  if (input.ownerAccountId) {
    const owner = await getAccountOrThrow(input.ownerAccountId);
    if (owner.status !== "ACTIVE") throw conflictError("O novo dono precisa estar com a conta ativa.");

    // Trocar o dono sem garantir o perfil deixaria a academia com um dono que
    // não consegue abri-la.
    await attachManagerToGym({
      gymId,
      authUserId: owner.authUserId,
      name: owner.name,
      email: owner.email,
    });
    await syncGymIdsMetadata(owner.authUserId);
    newOwnerAuthUserId = owner.authUserId;
  }

  await prisma.gym.update({
    where: { id: gymId },
    data: {
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      ...(newOwnerAuthUserId ? { ownerAuthUserId: newOwnerAuthUserId } : {}),
    },
  });
}

/** Exclui a academia e tudo que pertence a ela (cascata do schema). */
export async function deletePlatformGym(auth: AuthContext, gymId: string): Promise<void> {
  await requireReviewer(auth);

  const gym = await prisma.gym.findUnique({
    where: { id: gymId },
    select: { users: { select: { authUserId: true } } },
  });
  if (!gym) throw notFoundError("Academia não encontrada.");

  const affected = [...new Set(gym.users.map((user) => user.authUserId))];
  await prisma.gym.delete({ where: { id: gymId } });

  // Os perfis foram junto na cascata; sem o resync, o JWT desses gestores
  // continuaria autorizando o canal de tempo real de uma academia que não existe.
  await Promise.all(affected.map((authUserId) => syncGymIdsMetadata(authUserId)));
}

/** Dá a um gestor permissão de gerir uma academia que não é dele. */
export async function grantGymAccess(
  auth: AuthContext,
  gymId: string,
  accountId: string,
): Promise<void> {
  await requireReviewer(auth);
  const account = await getAccountOrThrow(accountId);
  if (account.status !== "ACTIVE") throw conflictError("A conta precisa estar ativa.");

  const gym = await prisma.gym.findUnique({ where: { id: gymId }, select: { id: true } });
  if (!gym) throw notFoundError("Academia não encontrada.");

  await attachManagerToGym({
    gymId,
    authUserId: account.authUserId,
    name: account.name,
    email: account.email,
  });
  await syncGymIdsMetadata(account.authUserId);
}

export async function revokeGymAccess(
  auth: AuthContext,
  gymId: string,
  accountId: string,
): Promise<void> {
  await requireReviewer(auth);
  const account = await getAccountOrThrow(accountId);

  const gym = await prisma.gym.findUnique({
    where: { id: gymId },
    select: { ownerAuthUserId: true },
  });
  if (!gym) throw notFoundError("Academia não encontrada.");
  if (gym.ownerAuthUserId === account.authUserId) {
    throw conflictError("O dono não pode perder o acesso. Troque o dono da academia antes.");
  }

  await prisma.user.deleteMany({ where: { gymId, authUserId: account.authUserId } });
  await syncGymIdsMetadata(account.authUserId);
}

// =========================================================================
// Panorama
// =========================================================================

export interface PlatformOverviewDto {
  gyms: { total: number; active: number };
  accounts: { total: number; pending: number; active: number; blocked: number };
}

export async function getPlatformOverview(): Promise<PlatformOverviewDto> {
  const [total, active, byStatus] = await Promise.all([
    prisma.gym.count(),
    prisma.gym.count({ where: { isActive: true } }),
    prisma.managerAccount.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);

  const count = (status: ManagerAccountStatus) =>
    byStatus.find((row) => row.status === status)?._count._all ?? 0;

  return {
    gyms: { total, active },
    accounts: {
      total: byStatus.reduce((sum, row) => sum + row._count._all, 0),
      pending: count("PENDING"),
      active: count("ACTIVE"),
      blocked: count("REJECTED") + count("SUSPENDED"),
    },
  };
}
