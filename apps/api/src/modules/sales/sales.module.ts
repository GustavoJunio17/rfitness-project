import { Module } from "@nestjs/common";
import { InventoryModule } from "../inventory/inventory.module";
import { FinanceModule } from "../finance/finance.module";
import { SalesController } from "./interface/http/sales.controller";
import { SalesService } from "./application/services/sales.service";
import { SALE_REPOSITORY } from "./domain/repositories/sale.repository";
import { PrismaSaleRepository } from "./infrastructure/persistence/prisma-sale.repository";

@Module({
  imports: [InventoryModule, FinanceModule],
  controllers: [SalesController],
  providers: [SalesService, { provide: SALE_REPOSITORY, useClass: PrismaSaleRepository }],
})
export class SalesModule {}
