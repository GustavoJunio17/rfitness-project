import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcrypt";

const prisma = new PrismaClient();

// Catálogo de permissões conhecidas do sistema (crescerá a cada fase).
// Mantido aqui (não em migration) porque é dado de referência, não estrutura.
const PERMISSIONS = [
  "gym:manage",
  "users:manage",
  "students:read",
  "students:write",
  "inventory:read",
  "inventory:write",
  "sales:read",
  "sales:write",
  "billing:read",
  "billing:write",
  "orders:read",
  "orders:write",
  "reports:read",
  "audit:read",
] as const;

const ROLE_PERMISSIONS: Record<string, readonly string[]> = {
  ADMIN: PERMISSIONS,
  RECEPTION: ["students:read", "students:write", "sales:read", "sales:write", "orders:read", "orders:write"],
  STOCKIST: ["inventory:read", "inventory:write", "orders:read"],
  FINANCE: ["billing:read", "billing:write", "reports:read"],
  TRAINER: ["students:read"],
};

async function main() {
  const permissions = await Promise.all(
    PERMISSIONS.map((key) =>
      prisma.permission.upsert({
        where: { key },
        update: {},
        create: { key },
      }),
    ),
  );
  const permissionByKey = new Map(permissions.map((p) => [p.key, p]));

  const gym = await prisma.gym.upsert({
    where: { slug: "rfitness-demo" },
    update: {},
    create: {
      name: "RFitness Academia (Demo)",
      slug: "rfitness-demo",
      email: "contato@rfitness-demo.com",
      primaryColor: "#E11D2E",
      secondaryColor: "#111111",
      accentColor: "#FFFFFF",
    },
  });

  for (const [roleName, keys] of Object.entries(ROLE_PERMISSIONS)) {
    const role = await prisma.role.upsert({
      where: { gymId_name: { gymId: gym.id, name: roleName } },
      update: {},
      create: {
        gymId: gym.id,
        name: roleName,
        isSystem: true,
        description: `Papel padrão: ${roleName}`,
      },
    });

    for (const key of keys) {
      const permission = permissionByKey.get(key);
      if (!permission) continue;
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
        update: {},
        create: { roleId: role.id, permissionId: permission.id },
      });
    }
  }

  const adminRole = await prisma.role.findUniqueOrThrow({
    where: { gymId_name: { gymId: gym.id, name: "ADMIN" } },
  });

  const passwordHash = await bcrypt.hash("Rfitness@123", 10);
  const admin = await prisma.user.upsert({
    where: { gymId_email: { gymId: gym.id, email: "admin@rfitness-demo.com" } },
    update: {},
    create: {
      gymId: gym.id,
      name: "Administrador RFitness",
      email: "admin@rfitness-demo.com",
      passwordHash,
    },
  });

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: admin.id, roleId: adminRole.id } },
    update: {},
    create: { userId: admin.id, roleId: adminRole.id },
  });

  await prisma.billingRule.createMany({
    data: [-1, 0, 1, 3, 7, 15].map((offsetDays) => ({
      gymId: gym.id,
      offsetDays,
      messageTemplate:
        offsetDays < 0
          ? "Olá {{name}}! Sua mensalidade vence em {{days}} dia(s). Evite bloqueios no acesso."
          : offsetDays === 0
            ? "Olá {{name}}! Sua mensalidade vence hoje."
            : "Olá {{name}}! Sua mensalidade venceu há {{days}} dia(s). Clique aqui para pagar.",
    })),
    skipDuplicates: true,
  });

  console.log("Seed concluída:");
  console.log(`  Academia: ${gym.name} (slug: ${gym.slug})`);
  console.log(`  Admin login: ${admin.email} / senha: Rfitness@123`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
