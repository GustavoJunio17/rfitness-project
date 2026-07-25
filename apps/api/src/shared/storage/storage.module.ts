import { Global, Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { STORAGE_REPOSITORY } from "./storage.repository";
import { LocalDiskStorageAdapter } from "./local-disk-storage.adapter";
import { SupabaseStorageAdapter } from "./supabase-storage.adapter";

// Only the selected driver is ever instantiated: SupabaseStorageAdapter's constructor
// requires valid credentials, so eagerly registering both as DI providers would crash
// bootstrap in local dev (no Supabase credentials configured).
@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: STORAGE_REPOSITORY,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        config.get<string>("storage.driver") === "supabase"
          ? new SupabaseStorageAdapter(config)
          : new LocalDiskStorageAdapter(config),
    },
  ],
  exports: [STORAGE_REPOSITORY],
})
export class StorageModule {}
