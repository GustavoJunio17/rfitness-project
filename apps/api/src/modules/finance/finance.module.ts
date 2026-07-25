import { Module } from "@nestjs/common";
import { StudentsModule } from "../students/students.module";
import { FinanceController } from "./interface/http/finance.controller";
import { FinanceAnalyticsService } from "./application/services/finance-analytics.service";
import { CashFlowService } from "./application/services/cash-flow.service";
import { FINANCE_ANALYTICS_REPOSITORY } from "./domain/repositories/finance-analytics.repository";
import { PrismaFinanceAnalyticsRepository } from "./infrastructure/persistence/prisma-finance-analytics.repository";
import { CASH_FLOW_REPOSITORY } from "./domain/repositories/cash-flow.repository";
import { PrismaCashFlowRepository } from "./infrastructure/persistence/prisma-cash-flow.repository";

@Module({
  imports: [StudentsModule],
  controllers: [FinanceController],
  providers: [
    FinanceAnalyticsService,
    CashFlowService,
    { provide: FINANCE_ANALYTICS_REPOSITORY, useClass: PrismaFinanceAnalyticsRepository },
    { provide: CASH_FLOW_REPOSITORY, useClass: PrismaCashFlowRepository },
  ],
  exports: [CashFlowService],
})
export class FinanceModule {}
