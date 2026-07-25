import { Module } from "@nestjs/common";
import { NotificationsModule } from "../notifications/notifications.module";
import { InventoryController } from "./interface/http/inventory.controller";
import { InventoryService } from "./application/services/inventory.service";
import { LowStockAlertService } from "./application/services/low-stock-alert.service";
import { StockAlertScheduler } from "./interface/jobs/stock-alert.scheduler";
import { STOCK_VARIANT_REPOSITORY } from "./domain/repositories/stock-variant.repository";
import { PrismaStockVariantRepository } from "./infrastructure/persistence/prisma-stock-variant.repository";
import { STOCK_MOVEMENT_REPOSITORY } from "./domain/repositories/stock-movement.repository";
import { PrismaStockMovementRepository } from "./infrastructure/persistence/prisma-stock-movement.repository";
import { STOCK_ALERT_REPOSITORY } from "./domain/repositories/stock-alert.repository";
import { PrismaStockAlertRepository } from "./infrastructure/persistence/prisma-stock-alert.repository";

@Module({
  imports: [NotificationsModule],
  controllers: [InventoryController],
  providers: [
    InventoryService,
    LowStockAlertService,
    StockAlertScheduler,
    { provide: STOCK_VARIANT_REPOSITORY, useClass: PrismaStockVariantRepository },
    { provide: STOCK_MOVEMENT_REPOSITORY, useClass: PrismaStockMovementRepository },
    { provide: STOCK_ALERT_REPOSITORY, useClass: PrismaStockAlertRepository },
  ],
  exports: [InventoryService, LowStockAlertService],
})
export class InventoryModule {}
