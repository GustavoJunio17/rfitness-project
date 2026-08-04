import { z } from "zod";
import { isValidCpf, PASSWORD_MIN_LENGTH } from "@rfitness/core";

/** Schemas compartilhados pelos route handlers. Um só lugar para os enums. */

export const uuidParam = z.object({ id: z.string().uuid("Identificador inválido.") });

export const paymentMethodSchema = z.enum(["CASH", "CREDIT_CARD", "DEBIT_CARD", "PIX", "BOLETO"]);
export const deliveryTypeSchema = z.enum(["DELIVERY", "PICKUP"]);
export const orderStatusSchema = z.enum([
  "PENDING",
  "SEPARATING",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "CANCELLED",
]);
export const productStatusSchema = z.enum(["ACTIVE", "INACTIVE", "DISCONTINUED"]);
export const studentStatusSchema = z.enum(["ACTIVE", "OVERDUE", "SUSPENDED", "CANCELLED"]);
export const movementTypeSchema = z.enum([
  "IN",
  "OUT",
  "SALE",
  "EXCHANGE",
  "LOSS",
  "EXPIRATION",
  "INVENTORY_ADJUSTMENT",
]);

const optionalString = z.string().trim().max(500).optional().nullable();
const money = z.number().finite().min(0).max(99_999_999);
const positiveInt = z.number().int().positive();

// O slug da academia não entra aqui de propósito: é interno e derivado do nome
// no servidor, para o cliente não escolher nem descobrir o identificador.
//
// O cadastro pede o mínimo: nome, e-mail e senha. Academia não entra aqui nem
// depois — cadastrar unidade e vincular gestor é da administração da RFitness.
export const signUpSchema = z.object({
  requesterName: z.string().trim().min(2).max(120),
  requesterEmail: z.string().trim().email(),
  password: z.string().min(PASSWORD_MIN_LENGTH, "A senha deve ter no mínimo 8 caracteres.").max(72),
});

export const managerAccountStatusSchema = z.enum(["PENDING", "ACTIVE", "REJECTED", "SUSPENDED"]);

/** Paginação das listagens do console. */
const pageQuery = {
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(5).max(100).optional(),
};

export const managerAccountQuery = z.object({
  status: managerAccountStatusSchema.optional(),
  search: z.string().trim().min(1).max(120).optional(),
  ...pageQuery,
});

export const platformGymQuery = z.object({
  search: z.string().trim().min(1).max(120).optional(),
  ...pageQuery,
});

export const createManagerAccountSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email(),
  password: z.string().min(PASSWORD_MIN_LENGTH, "A senha deve ter no mínimo 8 caracteres.").max(72),
  phone: z.string().trim().max(20).optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable(),
});

export const updateManagerAccountSchema = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    phone: z.string().trim().max(20).optional().nullable(),
    notes: z.string().trim().max(1000).optional().nullable(),
    status: managerAccountStatusSchema.optional(),
    decisionReason: z.string().trim().max(500).optional().nullable(),
  })
  .refine((value) => Object.keys(value).length > 0, "Nada para alterar.");

export const setPasswordSchema = z.object({
  password: z.string().min(PASSWORD_MIN_LENGTH, "A senha deve ter no mínimo 8 caracteres.").max(72),
});

// Dono opcional: a academia pode nascer sem gestor e receber um depois, pelo
// detalhe da conta.
export const createPlatformGymSchema = z.object({
  name: z.string().trim().min(2).max(120),
  ownerAccountId: z.string().uuid().optional().nullable(),
});

export const updatePlatformGymSchema = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    isActive: z.boolean().optional(),
    ownerAccountId: z.string().uuid().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "Nada para alterar.");

export const gymAccessSchema = z.object({ accountId: z.string().uuid() });

export const accountIdParam = z.object({
  id: z.string().uuid("Identificador inválido."),
  accountId: z.string().uuid("Identificador inválido."),
});

export const activeGymSchema = z.object({ gymId: z.string().uuid() });

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Informe a senha atual."),
  newPassword: z.string().min(PASSWORD_MIN_LENGTH, "A senha deve ter no mínimo 8 caracteres.").max(72),
});

export const cartItemsSchema = z
  .array(z.object({ variantId: z.string().uuid(), quantity: positiveInt }))
  .min(1, "Informe pelo menos um item.");

export const createSaleSchema = z.object({
  items: cartItemsSchema,
  paymentMethod: paymentMethodSchema,
  discount: money.optional(),
  studentId: z.string().uuid().optional().nullable(),
});

export const createOrderSchema = z.object({
  studentId: z.string().uuid().optional().nullable(),
  customerName: z.string().trim().min(2).max(120),
  customerPhone: z.string().trim().min(8).max(20),
  address: optionalString,
  deliveryType: deliveryTypeSchema,
  paymentMethod: paymentMethodSchema,
  notes: optionalString,
  items: cartItemsSchema,
});

export const updateOrderStatusSchema = z.object({ status: orderStatusSchema });

export const registerMovementSchema = z.object({
  variantId: z.string().uuid(),
  type: movementTypeSchema,
  quantity: z.number().int(),
  reason: optionalString,
});

export const variantWriteSchema = z.object({
  sku: z.string().trim().max(60).optional().nullable(),
  brandId: z.string().uuid().optional().nullable(),
  flavor: optionalString,
  weight: optionalString,
  barcode: z.string().trim().max(60).optional().nullable(),
  location: optionalString,
  batch: optionalString,
  expiresAt: z.string().datetime().optional().nullable(),
  costPrice: money,
  salePrice: money,
  minQuantity: z.number().int().min(0),
  maxQuantity: z.number().int().min(0).optional().nullable(),
  initialQuantity: z.number().int().min(0).optional(),
});

export const createProductSchema = z.object({
  name: z.string().trim().min(2).max(150),
  description: optionalString,
  categoryId: z.string().uuid().optional().nullable(),
  supplierId: z.string().uuid().optional().nullable(),
  status: productStatusSchema.optional(),
  variants: z.array(variantWriteSchema).optional(),
});

export const updateProductSchema = createProductSchema.partial().omit({ variants: true });
export const updateVariantSchema = variantWriteSchema.partial().omit({ initialQuantity: true });

export const nameSchema = z.object({ name: z.string().trim().min(1).max(120) });

export const supplierSchema = z.object({
  name: z.string().trim().min(1).max(120),
  cnpj: optionalString,
  phone: optionalString,
  email: z.string().trim().email().optional().nullable(),
  address: optionalString,
});

export const planSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: optionalString,
  price: money,
  durationDays: positiveInt,
  isActive: z.boolean().optional(),
});

export const studentSchema = z.object({
  name: z.string().trim().min(2).max(120),
  // A tela já avisa enquanto digita, mas ela não é a única porta: a mesma
  // regra vale para qualquer cliente da API. Vazio continua aceito — CPF é
  // opcional no cadastro.
  cpf: z
    .string()
    .trim()
    .max(20)
    .refine((value) => value === "" || isValidCpf(value), "CPF inválido.")
    .optional()
    .nullable(),
  phone: z.string().trim().max(20).optional().nullable(),
  whatsapp: z.string().trim().max(20).optional().nullable(),
  email: z.string().trim().email().optional().nullable(),
  address: optionalString,
  trainerName: optionalString,
  notes: optionalString,
});

export const enrollSchema = z.object({
  planId: z.string().uuid(),
  startDate: z.string().datetime().optional(),
});

export const goalSchema = z.object({
  description: z.string().trim().min(2).max(300),
  targetDate: z.string().datetime().optional().nullable(),
});

export const updateGoalSchema = z.object({
  description: z.string().trim().min(2).max(300).optional(),
  targetDate: z.string().datetime().optional().nullable(),
  achieved: z.boolean().optional(),
});

export const noteSchema = z.object({ content: z.string().trim().min(1).max(2000) });

export const cashFlowEntrySchema = z.object({
  description: z.string().trim().min(2).max(200),
  amount: z.number().finite().refine((value) => value !== 0, "O valor não pode ser zero."),
  category: z.string().trim().min(2).max(60),
  occurredAt: z.string().datetime().optional(),
});

export const whatsappSettingsSchema = z.object({
  instanceName: z.string().trim().min(2).max(80).nullable(),
});

/** Query strings chegam como string; `coerce` converte antes de validar. */
export const booleanQuery = z
  .enum(["true", "false"])
  .transform((value) => value === "true")
  .optional();

export const daysQuery = z.coerce.number().int().min(1).max(365).optional();
export const limitQuery = z.coerce.number().int().min(1).max(100).optional();
