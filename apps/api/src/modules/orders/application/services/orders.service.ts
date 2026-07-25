import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { OrderStatus } from "@rfitness/database";
import { InventoryService } from "../../../inventory/application/services/inventory.service";
import { RealtimeService } from "../../../../shared/realtime/realtime.service";
import { NotificationsService } from "../../../notifications/application/services/notifications.service";
import {
  ORDER_REPOSITORY,
  Order,
  OrderDetail,
  OrderFilters,
  OrderLineToCreate,
  OrderRepository,
} from "../../domain/repositories/order.repository";
import { CreateOrderDto } from "../dto/create-order.dto";

const VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.PENDING]: [OrderStatus.SEPARATING, OrderStatus.CANCELLED],
  [OrderStatus.SEPARATING]: [OrderStatus.OUT_FOR_DELIVERY, OrderStatus.CANCELLED],
  [OrderStatus.OUT_FOR_DELIVERY]: [OrderStatus.DELIVERED, OrderStatus.CANCELLED],
  [OrderStatus.DELIVERED]: [],
  [OrderStatus.CANCELLED]: [],
};

export interface CreateOrderItemInput {
  variantId: string;
  quantity: number;
}

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    @Inject(ORDER_REPOSITORY) private readonly orders: OrderRepository,
    private readonly inventoryService: InventoryService,
    private readonly realtimeService: RealtimeService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async createOrder(
    gymId: string,
    input: Omit<CreateOrderDto, "items"> & { items: CreateOrderItemInput[] },
  ): Promise<Order> {
    const mergedQuantities = new Map<string, number>();
    for (const item of input.items) {
      mergedQuantities.set(item.variantId, (mergedQuantities.get(item.variantId) ?? 0) + item.quantity);
    }
    const variantIds = [...mergedQuantities.keys()];

    const orderableVariants = await this.orders.findOrderableVariants(gymId, variantIds);
    const variantById = new Map(orderableVariants.map((variant) => [variant.id, variant]));
    if (variantById.size !== variantIds.length) {
      throw new NotFoundException("Um ou mais SKUs não foram encontrados nesta academia.");
    }

    const lines: OrderLineToCreate[] = [];
    let totalAmount = 0;
    for (const [variantId, quantity] of mergedQuantities) {
      const variant = variantById.get(variantId)!;
      if (variant.currentQuantity < quantity) {
        throw new BadRequestException(`Estoque insuficiente para o SKU ${variant.sku}.`);
      }
      const unitPrice = Number(variant.salePrice);
      totalAmount += unitPrice * quantity;
      lines.push({ variantId, quantity, unitPrice });
    }

    const order = await this.orders.create({
      gymId,
      studentId: input.studentId,
      customerName: input.customerName,
      customerPhone: input.customerPhone,
      address: input.address,
      deliveryType: input.deliveryType,
      paymentMethod: input.paymentMethod,
      notes: input.notes,
      totalAmount,
      lines,
    });

    try {
      this.realtimeService.emitToGym(gymId, "order.created", { orderId: order.id });
      await this.notificationsService.create(gymId, "NEW_ORDER", "Novo pedido", `Pedido #${order.orderNumber} recebido.`);
    } catch (error) {
      this.logger.warn(`Falha ao notificar novo pedido ${order.id}: ${error}`);
    }

    return order;
  }

  listOrders(gymId: string, filters: OrderFilters): Promise<Order[]> {
    return this.orders.findMany(gymId, filters);
  }

  async getOrder(gymId: string, id: string): Promise<OrderDetail> {
    const order = await this.orders.findById(gymId, id);
    if (!order) throw new NotFoundException("Pedido não encontrado.");
    return order;
  }

  getOpenCount(gymId: string): Promise<number> {
    return this.orders.countOpen(gymId);
  }

  async updateStatus(gymId: string, orderId: string, status: OrderStatus, changedBy: string): Promise<Order> {
    const order = await this.getOrder(gymId, orderId);
    const allowedNextStatuses = VALID_TRANSITIONS[order.status];
    if (!allowedNextStatuses.includes(status)) {
      throw new BadRequestException(
        `Não é possível mudar o pedido de ${order.status} para ${status}.`,
      );
    }

    if (status === OrderStatus.DELIVERED) {
      // Pre-check stock for every item before applying any movement — reduces
      // (does not fully eliminate, since each item's movement is still its own
      // transaction) the risk of a partial stock deduction across items.
      for (const item of order.items) {
        // eslint-disable-next-line no-await-in-loop
        const [variant] = await this.orders.findOrderableVariants(gymId, [item.variantId]);
        if (!variant || variant.currentQuantity < item.quantity) {
          throw new BadRequestException(`Estoque insuficiente para o SKU ${item.sku} na entrega deste pedido.`);
        }
      }

      await Promise.all(
        order.items.map((item) =>
          this.inventoryService.registerMovement(
            gymId,
            { variantId: item.variantId, type: "OUT", quantity: item.quantity, reason: `Pedido #${order.orderNumber}` },
            changedBy,
          ),
        ),
      );
    }

    const updated = await this.orders.updateStatus(gymId, orderId, status, changedBy);
    this.realtimeService.emitToGym(gymId, "order.status_changed", { orderId, status });
    return updated;
  }
}
