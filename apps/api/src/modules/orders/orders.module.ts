import { Module } from "@nestjs/common";
import { InventoryModule } from "../inventory/inventory.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { OrdersController } from "./interface/http/orders.controller";
import { OrdersService } from "./application/services/orders.service";
import { ORDER_REPOSITORY } from "./domain/repositories/order.repository";
import { PrismaOrderRepository } from "./infrastructure/persistence/prisma-order.repository";

@Module({
  imports: [InventoryModule, NotificationsModule],
  controllers: [OrdersController],
  providers: [OrdersService, { provide: ORDER_REPOSITORY, useClass: PrismaOrderRepository }],
  exports: [OrdersService],
})
export class OrdersModule {}
