import { buildGymSlugBase, resolveGymSlug, type Role } from "@rfitness/core";
import type { Prisma } from "@prisma/client";
import { prisma } from "../../db";
import { getSupabaseAdmin } from "../../supabase/admin";

export const SYSTEM_ROLES: Role[] = ["ADMIN", "RECEPTION", "STOCKIST", "FINANCE", "TRAINER"];

const BILLING_OFFSETS = [-1, 0, 1, 3, 7, 15];

function billingTemplate(offsetDays: number): string {
  if (offsetDays < 0) return "Olá {{nome}}! Sua mensalidade vence em {{dias}} dia(s).";
  if (offsetDays === 0) return "Olá {{nome}}! Sua mensalidade vence hoje.";
  return "Olá {{nome}}! Sua mensalidade está em atraso há {{dias}} dia(s).";
}

/**
 * Slug único a partir do nome. Colisão vira sufixo em vez de erro: o gestor não
 * escolhe nem enxerga esse identificador, então recusar o nome "Unidade Centro"
 * porque outra rede já usou seria barrar por um detalhe interno.
 */
async function nextSlug(gymName: string): Promise<string> {
  const base = buildGymSlugBase(gymName);
  const conflicting = await prisma.gym.findMany({
    where: { slug: { startsWith: base } },
    select: { slug: true },
  });
  return resolveGymSlug(
    gymName,
    conflicting.map((gym) => gym.slug),
  );
}

export interface ProvisionGymInput {
  gymName: string;
  /** Gestor dono: vira o perfil ADMIN da unidade. */
  ownerAuthUserId: string;
  ownerName: string;
  ownerEmail: string;
}

export interface ProvisionedGym {
  id: string;
  name: string;
  slug: string;
  userId: string;
}

/**
 * Cria uma academia pronta para uso: papéis do sistema, regras de cobrança
 * padrão e o perfil ADMIN do gestor — tudo numa transação.
 *
 * É o único caminho para nascer uma academia (aprovação de pedido ou nova
 * unidade da rede). Uma unidade sem papéis ou sem dono seria um tenant em que
 * ninguém consegue entrar.
 */
export async function provisionGym(input: ProvisionGymInput): Promise<ProvisionedGym> {
  const slug = await nextSlug(input.gymName);
  const name = input.gymName.trim();
  const email = input.ownerEmail.trim().toLowerCase();

  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const gym = await tx.gym.create({
      data: { name, slug, ownerAuthUserId: input.ownerAuthUserId },
    });

    await tx.role.createMany({
      data: SYSTEM_ROLES.map((roleName) => ({ gymId: gym.id, name: roleName, isSystem: true })),
    });
    await tx.billingRule.createMany({
      data: BILLING_OFFSETS.map((offsetDays) => ({
        gymId: gym.id,
        offsetDays,
        messageTemplate: billingTemplate(offsetDays),
      })),
    });

    const adminRole = await tx.role.findUniqueOrThrow({
      where: { gymId_name: { gymId: gym.id, name: "ADMIN" } },
      select: { id: true },
    });

    const user = await tx.user.create({
      data: {
        authUserId: input.ownerAuthUserId,
        gymId: gym.id,
        name: input.ownerName.trim(),
        email,
        roles: { create: { roleId: adminRole.id } },
      },
      select: { id: true },
    });

    return { id: gym.id, name: gym.name, slug: gym.slug, userId: user.id };
  });
}

/**
 * Garante o perfil ADMIN de um gestor numa academia que já existe.
 *
 * Idempotente: chamar de novo para quem já tem acesso não duplica nem falha —
 * é o que permite usar a mesma operação para conceder acesso e para trocar o
 * dono da unidade.
 */
export async function attachManagerToGym(input: {
  gymId: string;
  authUserId: string;
  name: string;
  email: string;
}): Promise<{ userId: string }> {
  const email = input.email.trim().toLowerCase();

  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const user = await tx.user.upsert({
      where: { authUserId_gymId: { authUserId: input.authUserId, gymId: input.gymId } },
      update: { status: "ACTIVE" },
      create: {
        authUserId: input.authUserId,
        gymId: input.gymId,
        name: input.name.trim(),
        email,
      },
      select: { id: true },
    });

    const adminRole = await tx.role.findUniqueOrThrow({
      where: { gymId_name: { gymId: input.gymId, name: "ADMIN" } },
      select: { id: true },
    });

    await tx.userRole.upsert({
      where: { userId_roleId: { userId: user.id, roleId: adminRole.id } },
      update: {},
      create: { userId: user.id, roleId: adminRole.id },
    });

    return { userId: user.id };
  });
}

/**
 * Republica em `app_metadata.gym_ids` a lista de academias da pessoa.
 *
 * Esse metadata não autoriza nada na API — o servidor lê os vínculos do banco.
 * Ele existe para a policy de RLS de `realtime_events`, que só enxerga o JWT.
 * Sem o sync, o gestor entra na unidade nova e o dashboard fica mudo.
 */
export async function syncGymIdsMetadata(authUserId: string): Promise<void> {
  const profiles = await prisma.user.findMany({
    where: { authUserId, status: "ACTIVE" },
    select: { gymId: true },
  });

  const { error } = await getSupabaseAdmin().auth.admin.updateUserById(authUserId, {
    app_metadata: { gym_ids: profiles.map((profile) => profile.gymId) },
  });

  if (error) {
    // Não derruba a operação de negócio: a academia existe e a API já responde
    // por ela. O que fica degradado é só o tempo real, até o próximo sync.
    // eslint-disable-next-line no-console
    console.warn(`[identity] falha ao sincronizar gym_ids de ${authUserId}:`, error.message);
  }
}
