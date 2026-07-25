import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { ScheduleModule } from "@nestjs/schedule";
import { ServeStaticModule } from "@nestjs/serve-static";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { APP_GUARD } from "@nestjs/core";
import { join } from "path";
import configuration from "./config/configuration";
import { PrismaModule } from "./shared/prisma/prisma.module";
import { StorageModule } from "./shared/storage/storage.module";
import { RealtimeModule } from "./shared/realtime/realtime.module";
import { AuditModule } from "./modules/audit/audit.module";
import { IdentityModule } from "./modules/identity/identity.module";
import { CatalogModule } from "./modules/catalog/catalog.module";
import { InventoryModule } from "./modules/inventory/inventory.module";
import { SalesModule } from "./modules/sales/sales.module";
import { FinanceModule } from "./modules/finance/finance.module";
import { StudentsModule } from "./modules/students/students.module";
import { WhatsAppAiModule } from "./modules/whatsapp-ai/whatsapp-ai.module";
import { NotificationsModule } from "./modules/notifications/notifications.module";
import { OrdersModule } from "./modules/orders/orders.module";
import { AppController } from "./app.controller";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration], envFilePath: [".env", "../../.env"] }),
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), process.env.LOCAL_UPLOADS_DIR ?? "uploads"),
      serveRoot: "/uploads",
    }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    PrismaModule,
    StorageModule,
    RealtimeModule,
    AuditModule,
    IdentityModule,
    CatalogModule,
    InventoryModule,
    StudentsModule,
    SalesModule,
    FinanceModule,
    NotificationsModule,
    OrdersModule,
    WhatsAppAiModule,
  ],
  controllers: [AppController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
