import {
  buildGymSlugBase,
  conflictError,
  evaluatePassword,
  notFoundError,
  resolveGymSlug,
  validationError,
  type Role,
} from "@rfitness/core";
import { prisma } from "../../db";
import { getSupabaseAdmin } from "../../supabase/admin";
import { writeAuditLog } from "../../audit/audit-log";

const SYSTEM_ROLES: Role[] = ["ADMIN", "RECEPTION", "STOCKIST", "FINANCE", "TRAINER"];

const BILLING_OFFSETS = [-1, 0, 1, 3, 7, 15];

export interface RegisterGymInput {
  gymName: string;
  adminName: string;
  adminEmail: string;
  adminPassword: string;
}

export interface CurrentUserDto {
  id: string;
  name: string;
  email: string;
  roles: Role[];
  gym: { id: string; name: string; slug: string; whatsappInstanceName: string | null };
}

/**
 * Cadastro de academia: cria o usuário no Supabase Auth e o tenant no banco.
 *
 * Ordem importa. O usuário de Auth vem primeiro porque `gym_id` precisa existir
 * em `app_metadata`… mas o gym só existe depois. Resolvemos criando o gym na
 * transação, depois o usuário de Auth com o metadata correto e, se a gravação do
 * perfil falhar, apagando o usuário de Auth — assim não sobra credencial órfã
 * capaz de logar sem tenant.
 */
export async function registerGym(
  input: RegisterGymInput,
  meta: { ip: string | null; userAgent: string | null },
): Promise<{ gymId: string; userId: string }> {
  // A força da senha é conferida aqui também: o medidor da tela é conveniência,
  // não barreira — quem chama a API direto passa pela mesma regra.
  const strength = evaluatePassword(input.adminPassword, [input.adminName, input.adminEmail, input.gymName]);
  if (!strength.acceptable) {
    throw validationError(strength.hint ?? "Escolha uma senha mais forte.");
  }

  // Slug interno derivado do nome; colisão resolve com sufixo em vez de erro na
  // cara do usuário, que nem sabe que esse identificador existe.
  const base = buildGymSlugBase(input.gymName);
  const conflicting = await prisma.gym.findMany({
    where: { slug: { startsWith: base } },
    select: { slug: true },
  });
  const slug = resolveGymSlug(input.gymName, conflicting.map((gym) => gym.slug));

  const supabase = getSupabaseAdmin();

  // 1. Tenant + papéis do sistema + regras de cobrança padrão.
  const gym = await prisma.$transaction(async (tx) => {
    const created = await tx.gym.create({ data: { name: input.gymName.trim(), slug } });

    await tx.role.createMany({
      data: SYSTEM_ROLES.map((name) => ({ gymId: created.id, name, isSystem: true })),
    });
    await tx.billingRule.createMany({
      data: BILLING_OFFSETS.map((offsetDays) => ({
        gymId: created.id,
        offsetDays,
        messageTemplate:
          offsetDays < 0
            ? "Olá {{nome}}! Sua mensalidade vence em {{dias}} dia(s)."
            : offsetDays === 0
              ? "Olá {{nome}}! Sua mensalidade vence hoje."
              : "Olá {{nome}}! Sua mensalidade está em atraso há {{dias}} dia(s).",
      })),
    });

    return created;
  });

  // 2. Usuário no Supabase Auth com gym_id/roles em app_metadata (só o service
  //    role escreve app_metadata — o usuário não consegue se auto-promover).
  const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
    email: input.adminEmail.trim().toLowerCase(),
    password: input.adminPassword,
    email_confirm: true,
    app_metadata: { gym_id: gym.id, gym_slug: slug, roles: ["ADMIN"] },
    user_metadata: { name: input.adminName.trim() },
  });

  if (authError || !authUser.user) {
    await prisma.gym.delete({ where: { id: gym.id } }).catch(() => undefined);
    if (/already been registered|already exists/i.test(authError?.message ?? "")) {
      throw conflictError("Este e-mail já está cadastrado.");
    }
    throw validationError(`Falha ao criar o usuário administrador: ${authError?.message}`);
  }

  // 3. Perfil + vínculo com o papel ADMIN.
  try {
    const adminRole = await prisma.role.findUniqueOrThrow({
      where: { gymId_name: { gymId: gym.id, name: "ADMIN" } },
    });

    const user = await prisma.user.create({
      data: {
        authUserId: authUser.user.id,
        gymId: gym.id,
        name: input.adminName.trim(),
        email: input.adminEmail.trim().toLowerCase(),
        roles: { create: { roleId: adminRole.id } },
      },
    });

    await writeAuditLog({
      gymId: gym.id,
      userId: user.id,
      action: "auth.register_gym",
      entityType: "Gym",
      entityId: gym.id,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    return { gymId: gym.id, userId: user.id };
  } catch (error) {
    // Rollback do usuário de Auth: sem isso ficaria uma credencial válida
    // apontando para um tenant sem perfil.
    await supabase.auth.admin.deleteUser(authUser.user.id).catch(() => undefined);
    await prisma.gym.delete({ where: { id: gym.id } }).catch(() => undefined);
    throw error;
  }
}

/** Perfil da sessão atual. Cria o perfil se o usuário de Auth ainda não tiver um. */
export async function getCurrentUser(auth: {
  authUserId: string;
  gymId: string;
  email: string;
  name: string;
  roles: Role[];
}): Promise<CurrentUserDto> {
  const gym = await prisma.gym.findUnique({
    where: { id: auth.gymId },
    select: { id: true, name: true, slug: true, whatsappInstanceName: true },
  });
  if (!gym) throw notFoundError("Academia não encontrada.");

  const user = await prisma.user.upsert({
    where: { authUserId: auth.authUserId },
    update: { lastLoginAt: new Date() },
    create: {
      authUserId: auth.authUserId,
      gymId: auth.gymId,
      name: auth.name,
      email: auth.email,
      lastLoginAt: new Date(),
    },
    select: { id: true, name: true, email: true },
  });

  return { id: user.id, name: user.name, email: user.email, roles: auth.roles, gym };
}

/**
 * id do `User` (perfil) a partir do id de Auth — usado onde o banco precisa da
 * FK do perfil (ex.: `Sale.employeeId`), não do id do Supabase.
 */
export async function resolveUserId(authUserId: string, gymId: string): Promise<string> {
  const user = await prisma.user.findUnique({ where: { authUserId }, select: { id: true, gymId: true } });
  if (!user || user.gymId !== gymId) {
    throw notFoundError("Perfil de usuário não encontrado nesta academia.");
  }
  return user.id;
}
