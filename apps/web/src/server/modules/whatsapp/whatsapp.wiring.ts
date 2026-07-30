import { toNumber } from "@rfitness/core";
import { prisma } from "../../db";
import { publishRealtime } from "../../realtime/publisher";
import { ordersService } from "../orders/orders.repository";
import { studentsService } from "../students/students.repository";
import { getClaudeAgent } from "./claude-agent";
import { evolutionGateway } from "./evolution-gateway";
import { prismaConversationRepository } from "./whatsapp.repository";
import { createWhatsAppService } from "./whatsapp.service";
import type { ProductMatch, WhatsAppSideEffects } from "./whatsapp.ports";

/**
 * Ponto de composição do módulo. As dependências de `students` e `orders` entram
 * por aqui (e não por import direto dentro do service) para manter o service
 * testável e para que `students` possa chamar as boas-vindas via import dinâmico
 * sem fechar um ciclo.
 */
const sideEffects: WhatsAppSideEffects = {
  publish: publishRealtime,

  async findStudentByPhone(gymId, phone) {
    const student = await studentsService.findByPhone(gymId, phone);
    if (!student) return null;
    return {
      id: student.id,
      name: student.name,
      whatsapp: student.whatsapp,
      status: student.status,
      subscriptions: student.subscriptions.map((subscription) => ({
        planName: subscription.planName,
        dueDate: subscription.dueDate,
        cancelledAt: subscription.cancelledAt,
      })),
    };
  },

  async getStudent(gymId, studentId) {
    const student = await studentsService.getStudent(gymId, studentId);
    return {
      id: student.id,
      name: student.name,
      whatsapp: student.whatsapp,
      status: student.status,
      subscriptions: student.subscriptions.map((subscription) => ({
        planName: subscription.planName,
        dueDate: subscription.dueDate,
        cancelledAt: subscription.cancelledAt,
      })),
    };
  },

  async searchProducts(gymId, query): Promise<ProductMatch[]> {
    const variants = await prisma.productVariant.findMany({
      where: {
        product: { gymId, status: "ACTIVE" },
        OR: [
          { sku: { contains: query, mode: "insensitive" } },
          { barcode: { contains: query } },
          { flavor: { contains: query, mode: "insensitive" } },
          { product: { name: { contains: query, mode: "insensitive" } } },
          { brand: { name: { contains: query, mode: "insensitive" } } },
        ],
      },
      include: { product: { select: { name: true } } },
      take: 20,
    });

    return variants.map((variant) => ({
      productName: variant.product.name,
      sku: variant.sku,
      variantId: variant.id,
      flavor: variant.flavor,
      weight: variant.weight,
      salePrice: toNumber(variant.salePrice),
      quantity: variant.currentQuantity,
    }));
  },

  async createOrder(gymId, input) {
    const order = await ordersService.createOrder(gymId, {
      studentId: input.studentId,
      customerName: input.customerName,
      customerPhone: input.customerPhone,
      address: input.address ?? null,
      deliveryType: input.deliveryType,
      paymentMethod: input.paymentMethod,
      items: input.items,
    });

    return { orderNumber: order.orderNumber, totalAmount: order.totalAmount, status: order.status };
  },
};

/**
 * Agente resolvido sob demanda: instanciar o cliente da Anthropic no import
 * exigiria env válido no build, e este módulo é alcançado por rotas que também
 * rodam em contextos onde a chave não existe (ex.: build da Vercel).
 */
const lazyAgent = { run: (params: Parameters<ReturnType<typeof getClaudeAgent>["run"]>[0]) => getClaudeAgent().run(params) };

export const whatsAppService = createWhatsAppService(
  prismaConversationRepository,
  evolutionGateway,
  lazyAgent,
  sideEffects,
);
