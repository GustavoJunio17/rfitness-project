import { Injectable, NotFoundException } from "@nestjs/common";
import { OrderStatus, Prisma } from "@rfitness/database";
import { PrismaService } from "../../../../shared/prisma/prisma.service";
import type {
  CreateOrderInput,
  Order,
  OrderDetail,
  OrderFilters,
  OrderRepository,
  OrderableVariant,
} from "../../domain/repositories/order.repository";

type PrismaOrderWithRelations = Prisma.OrderGetPayload<{
  include: { items: { include: { variant: true } }; statusHistory: true };
}>;

@Injectable()
export class PrismaOrderRepository implements OrderRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findOrderableVariants(gymId: string, variantIds: string[]): Promise<OrderableVariant[]> {
    const variants = await this.prisma.productVariant.findMany({
      where: { id: { in: variantIds }, product: { gymId } },
    });
    return variants.map((variant) => ({
      id: variant.id,
      sku: variant.sku,
      salePrice: variant.salePrice.toString(),
      currentQuantity: variant.currentQuantity,
    }));
  }

  async create(input: CreateOrderInput): Promise<Order> {
    const order = await this.prisma.$transaction(async (tx) => {
      const lastOrder = await tx.order.findFirst({
        where: { gymId: input.gymId },
        orderBy: { orderNumber: "desc" },
        select: { orderNumber: true },
      });
      const orderNumber = (lastOrder?.orderNumber ?? 0) + 1;

      const created = await tx.order.create({
        data: {
          gymId: input.gymId,
          orderNumber,
          studentId: input.studentId,
          customerName: input.customerName,
          customerPhone: input.customerPhone,
          address: input.address,
          deliveryType: input.deliveryType,
          paymentMethod: input.paymentMethod,
          notes: input.notes,
          totalAmount: input.totalAmount,
          items: {
            create: input.lines.map((line) => ({
              variantId: line.variantId,
              quantity: line.quantity,
              unitPrice: line.unitPrice,
            })),
          },
          statusHistory: { create: { status: OrderStatus.PENDING } },
        },
      });
      return created;
    });

    return this.toDomain(order);
  }

  async updateStatus(gymId: string, orderId: string, status: OrderStatus, changedBy?: string): Promise<Order> {
    await this.assertExists(gymId, orderId);
    const order = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.order.update({ where: { id: orderId }, data: { status } });
      await tx.orderStatusHistory.create({ data: { orderId, status, changedBy } });
      return updated;
    });
    return this.toDomain(order);
  }

  async findMany(gymId: string, filters: OrderFilters): Promise<Order[]> {
    const orders = await this.prisma.order.findMany({
      where: { gymId, status: filters.status },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return orders.map((order) => this.toDomain(order));
  }

  async findById(gymId: string, id: string): Promise<OrderDetail | null> {
    const order = await this.prisma.order.findFirst({
      where: { id, gymId },
      include: { items: { include: { variant: true } }, statusHistory: { orderBy: { changedAt: "asc" } } },
    });
    return order ? this.toDetailDomain(order) : null;
  }

  countOpen(gymId: string): Promise<number> {
    return this.prisma.order.count({
      where: { gymId, status: { notIn: [OrderStatus.DELIVERED, OrderStatus.CANCELLED] } },
    });
  }

  private async assertExists(gymId: string, id: string): Promise<void> {
    const order = await this.prisma.order.findFirst({ where: { id, gymId } });
    if (!order) throw new NotFoundException("Pedido não encontrado.");
  }

  private toDomain(order: {
    id: string;
    gymId: string;
    orderNumber: number;
    studentId: string | null;
    customerName: string;
    customerPhone: string;
    address: string | null;
    deliveryType: Prisma.OrderGetPayload<Record<string, never>>["deliveryType"];
    paymentMethod: Prisma.OrderGetPayload<Record<string, never>>["paymentMethod"];
    status: OrderStatus;
    totalAmount: Prisma.Decimal;
    notes: string | null;
    createdAt: Date;
  }): Order {
    return {
      id: order.id,
      gymId: order.gymId,
      orderNumber: order.orderNumber,
      studentId: order.studentId,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      address: order.address,
      deliveryType: order.deliveryType,
      paymentMethod: order.paymentMethod,
      status: order.status,
      totalAmount: order.totalAmount.toString(),
      notes: order.notes,
      createdAt: order.createdAt,
    };
  }

  private toDetailDomain(order: PrismaOrderWithRelations): OrderDetail {
    return {
      ...this.toDomain(order),
      items: order.items.map((item) => ({
        id: item.id,
        variantId: item.variantId,
        sku: item.variant.sku,
        quantity: item.quantity,
        unitPrice: item.unitPrice.toString(),
      })),
      statusHistory: order.statusHistory.map((entry) => ({
        id: entry.id,
        status: entry.status,
        changedAt: entry.changedAt,
        changedBy: entry.changedBy,
      })),
    };
  }
}
