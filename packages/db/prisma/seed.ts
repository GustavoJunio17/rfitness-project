/**
 * Seed do ambiente de demonstração.
 *
 * Cria a academia demo, papéis, permissões, catálogo e alunos de exemplo — e o
 * usuário administrador **no Supabase Auth**, com `gym_id`/`roles` em
 * `app_metadata` (é de lá que o servidor lê o tenant e o RBAC a cada request).
 *
 * Idempotente: rodar de novo atualiza em vez de duplicar.
 */
import { createClient } from "@supabase/supabase-js";
import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

const GYM_SLUG = "rfitness-demo";
const ADMIN_EMAIL = "admin@rfitness-demo.com";
const ADMIN_PASSWORD = "Rfitness@123";

const PERMISSION_KEYS = [
  "catalog:read",
  "catalog:write",
  "inventory:read",
  "inventory:write",
  "sales:read",
  "sales:write",
  "finance:read",
  "finance:write",
  "students:read",
  "students:write",
  "orders:read",
  "orders:write",
  "whatsapp:read",
  "whatsapp:write",
  "admin:manage",
];

const ROLE_PERMISSIONS: Record<string, string[]> = {
  ADMIN: PERMISSION_KEYS,
  RECEPTION: [
    "catalog:read",
    "inventory:read",
    "sales:read",
    "sales:write",
    "students:read",
    "students:write",
    "orders:read",
    "orders:write",
    "whatsapp:read",
  ],
  STOCKIST: ["catalog:read", "catalog:write", "inventory:read", "inventory:write", "orders:read"],
  FINANCE: ["finance:read", "finance:write", "sales:read"],
  TRAINER: ["students:read", "students:write"],
};

const BILLING_OFFSETS = [-1, 0, 1, 3, 7, 15];

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Variável ${name} não definida. O seed cria o admin no Supabase Auth e precisa das credenciais do projeto.`,
    );
  }
  return value;
}

/**
 * Cria (ou atualiza) o admin no Supabase Auth. `app_metadata` é gravado pelo
 * service role e não pode ser alterado pelo próprio usuário — por isso é o lugar
 * certo para `gym_id` e `roles`.
 */
async function upsertAuthAdmin(gymId: string): Promise<string> {
  const supabase = createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const appMetadata = { gym_id: gymId, gym_slug: GYM_SLUG, roles: ["ADMIN"] };

  const { data: created, error } = await supabase.auth.admin.createUser({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    email_confirm: true,
    app_metadata: appMetadata,
    user_metadata: { name: "Administrador RFitness" },
  });

  if (!error && created.user) return created.user.id;

  const alreadyExists =
    error?.status === 422 || /already been registered|already exists/i.test(error?.message ?? "");
  if (!alreadyExists) {
    throw new Error(`Falha ao criar o admin no Supabase Auth: ${error?.message}`);
  }

  // Já existe: localiza pelo e-mail e ressincroniza metadata/senha.
  const { data: list, error: listError } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (listError) throw new Error(`Falha ao listar usuários do Auth: ${listError.message}`);

  const existing = list.users.find((user) => user.email?.toLowerCase() === ADMIN_EMAIL);
  if (!existing) throw new Error(`Usuário ${ADMIN_EMAIL} existe no Auth mas não foi encontrado na listagem.`);

  const { error: updateError } = await supabase.auth.admin.updateUserById(existing.id, {
    password: ADMIN_PASSWORD,
    app_metadata: appMetadata,
  });
  if (updateError) throw new Error(`Falha ao atualizar o admin no Auth: ${updateError.message}`);

  return existing.id;
}

async function main() {
  // --- Permissões globais -------------------------------------------------
  await Promise.all(
    PERMISSION_KEYS.map((key) =>
      prisma.permission.upsert({ where: { key }, update: {}, create: { key } }),
    ),
  );
  const permissions = await prisma.permission.findMany();
  const permissionIdByKey = new Map(permissions.map((permission) => [permission.key, permission.id]));

  // --- Academia -----------------------------------------------------------
  const gym = await prisma.gym.upsert({
    where: { slug: GYM_SLUG },
    update: {},
    create: {
      name: "RFitness Academia (Demo)",
      slug: GYM_SLUG,
      email: "contato@rfitness-demo.com",
      phone: "+5531999990000",
      address: "Av. Principal, 1000 — Belo Horizonte/MG",
    },
  });

  // --- Papéis + permissões ------------------------------------------------
  for (const [roleName, keys] of Object.entries(ROLE_PERMISSIONS)) {
    const role = await prisma.role.upsert({
      where: { gymId_name: { gymId: gym.id, name: roleName } },
      update: { isSystem: true },
      create: { gymId: gym.id, name: roleName, isSystem: true },
    });

    for (const key of keys) {
      const permissionId = permissionIdByKey.get(key);
      if (!permissionId) continue;
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId } },
        update: {},
        create: { roleId: role.id, permissionId },
      });
    }
  }

  // --- Admin (Supabase Auth + perfil) ------------------------------------
  const authUserId = await upsertAuthAdmin(gym.id);
  const admin = await prisma.user.upsert({
    where: { authUserId },
    update: { gymId: gym.id, name: "Administrador RFitness", email: ADMIN_EMAIL, status: "ACTIVE" },
    create: {
      authUserId,
      gymId: gym.id,
      name: "Administrador RFitness",
      email: ADMIN_EMAIL,
    },
  });

  const adminRole = await prisma.role.findUniqueOrThrow({
    where: { gymId_name: { gymId: gym.id, name: "ADMIN" } },
  });
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: admin.id, roleId: adminRole.id } },
    update: {},
    create: { userId: admin.id, roleId: adminRole.id },
  });

  // --- Regras de cobrança (Fase 8) ---------------------------------------
  for (const offsetDays of BILLING_OFFSETS) {
    await prisma.billingRule.upsert({
      where: { gymId_offsetDays: { gymId: gym.id, offsetDays } },
      update: {},
      create: {
        gymId: gym.id,
        offsetDays,
        messageTemplate:
          offsetDays < 0
            ? "Olá {{nome}}! Sua mensalidade vence em {{dias}} dia(s). Qualquer dúvida, é só responder aqui."
            : offsetDays === 0
              ? "Olá {{nome}}! Sua mensalidade vence hoje."
              : "Olá {{nome}}! Sua mensalidade está em atraso há {{dias}} dia(s).",
      },
    });
  }

  // --- Planos -------------------------------------------------------------
  const planSeeds = [
    { name: "Mensal", price: new Prisma.Decimal("129.90"), durationDays: 30 },
    { name: "Trimestral", price: new Prisma.Decimal("349.90"), durationDays: 90 },
    { name: "Anual", price: new Prisma.Decimal("1199.90"), durationDays: 365 },
  ];
  for (const plan of planSeeds) {
    await prisma.plan.upsert({
      where: { gymId_name: { gymId: gym.id, name: plan.name } },
      update: { price: plan.price, durationDays: plan.durationDays },
      create: { gymId: gym.id, ...plan },
    });
  }

  // --- Catálogo -----------------------------------------------------------
  const categoryNames = ["Suplementos", "Bebidas", "Vestuário", "Acessórios"];
  for (const name of categoryNames) {
    await prisma.category.upsert({
      where: { gymId_name: { gymId: gym.id, name } },
      update: {},
      create: { gymId: gym.id, name },
    });
  }

  const brandNames = ["Growth", "Max Titanium", "Integralmedica", "RFitness"];
  for (const name of brandNames) {
    await prisma.brand.upsert({
      where: { gymId_name: { gymId: gym.id, name } },
      update: {},
      create: { gymId: gym.id, name },
    });
  }

  const supplier = await prisma.supplier.upsert({
    where: { gymId_name: { gymId: gym.id, name: "Distribuidora Fit" } },
    update: {},
    create: {
      gymId: gym.id,
      name: "Distribuidora Fit",
      cnpj: "12345678000199",
      phone: "+5531988887777",
      email: "vendas@distribuidorafit.com",
    },
  });

  const supplements = await prisma.category.findUniqueOrThrow({
    where: { gymId_name: { gymId: gym.id, name: "Suplementos" } },
  });
  const drinks = await prisma.category.findUniqueOrThrow({
    where: { gymId_name: { gymId: gym.id, name: "Bebidas" } },
  });
  const growth = await prisma.brand.findUniqueOrThrow({
    where: { gymId_name: { gymId: gym.id, name: "Growth" } },
  });
  const maxTitanium = await prisma.brand.findUniqueOrThrow({
    where: { gymId_name: { gymId: gym.id, name: "Max Titanium" } },
  });

  interface VariantSeed {
    sku: string;
    brandId?: string;
    flavor?: string;
    weight?: string;
    barcode?: string;
    costPrice: string;
    salePrice: string;
    minQuantity: number;
    currentQuantity: number;
  }

  const productSeeds: { name: string; categoryId: string; variants: VariantSeed[] }[] = [
    {
      name: "Whey Protein Concentrado",
      categoryId: supplements.id,
      variants: [
        {
          sku: "WHE-GRO-BAU-900G",
          brandId: growth.id,
          flavor: "Baunilha",
          weight: "900g",
          barcode: "7890000000017",
          costPrice: "79.90",
          salePrice: "139.90",
          minQuantity: 5,
          currentQuantity: 18,
        },
        {
          sku: "WHE-GRO-CHO-900G",
          brandId: growth.id,
          flavor: "Chocolate",
          weight: "900g",
          barcode: "7890000000024",
          costPrice: "79.90",
          salePrice: "139.90",
          minQuantity: 5,
          currentQuantity: 4,
        },
      ],
    },
    {
      name: "Creatina Monohidratada",
      categoryId: supplements.id,
      variants: [
        {
          sku: "CRE-MAX-300G",
          brandId: maxTitanium.id,
          weight: "300g",
          barcode: "7890000000031",
          costPrice: "89.00",
          salePrice: "149.00",
          minQuantity: 4,
          currentQuantity: 11,
        },
      ],
    },
    {
      name: "Água de Coco",
      categoryId: drinks.id,
      variants: [
        {
          sku: "AGU-RFI-1L",
          weight: "1L",
          barcode: "7890000000048",
          costPrice: "4.50",
          salePrice: "9.00",
          minQuantity: 12,
          currentQuantity: 40,
        },
      ],
    },
  ];

  for (const seed of productSeeds) {
    const existing = await prisma.product.findFirst({ where: { gymId: gym.id, name: seed.name } });
    const product =
      existing ??
      (await prisma.product.create({
        data: {
          gymId: gym.id,
          name: seed.name,
          categoryId: seed.categoryId,
          supplierId: supplier.id,
        },
      }));

    for (const variant of seed.variants) {
      await prisma.productVariant.upsert({
        where: { sku: variant.sku },
        update: {},
        create: {
          productId: product.id,
          brandId: variant.brandId ?? null,
          sku: variant.sku,
          flavor: variant.flavor ?? null,
          weight: variant.weight ?? null,
          barcode: variant.barcode ?? null,
          costPrice: new Prisma.Decimal(variant.costPrice),
          salePrice: new Prisma.Decimal(variant.salePrice),
          minQuantity: variant.minQuantity,
          currentQuantity: variant.currentQuantity,
        },
      });
    }
  }

  // --- Alunos -------------------------------------------------------------
  const monthly = await prisma.plan.findUniqueOrThrow({
    where: { gymId_name: { gymId: gym.id, name: "Mensal" } },
  });

  const studentSeeds = [
    { name: "Ana Souza", cpf: "11122233344", whatsapp: "5531999991111", phone: "5531999991111" },
    { name: "Bruno Lima", cpf: "55566677788", whatsapp: "5531999992222", phone: "5531999992222" },
  ];

  for (const seed of studentSeeds) {
    const student = await prisma.student.upsert({
      where: { gymId_cpf: { gymId: gym.id, cpf: seed.cpf } },
      update: {},
      create: { gymId: gym.id, ...seed },
    });

    const hasSubscription = await prisma.subscription.findFirst({ where: { studentId: student.id } });
    if (!hasSubscription) {
      const startDate = new Date();
      const dueDate = new Date(startDate);
      dueDate.setUTCDate(dueDate.getUTCDate() + monthly.durationDays);
      await prisma.subscription.create({
        data: { studentId: student.id, planId: monthly.id, startDate, dueDate },
      });
    }
  }

  // eslint-disable-next-line no-console
  console.log(
    [
      "Seed concluído.",
      `  Academia: ${gym.name} (slug: ${gym.slug})`,
      `  Login:    ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`,
      `  Catálogo: ${productSeeds.length} produtos, ${planSeeds.length} planos, ${studentSeeds.length} alunos`,
    ].join("\n"),
  );
}

main()
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
