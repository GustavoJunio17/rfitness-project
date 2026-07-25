import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { randomBytes } from "crypto";
import { extname } from "path";
import type { StorageRepository, UploadFileInput, UploadFileOutput } from "./storage.repository";

@Injectable()
export class SupabaseStorageAdapter implements StorageRepository {
  private readonly client: SupabaseClient;
  private readonly bucket: string;

  constructor(private readonly configService: ConfigService) {
    this.client = createClient(
      this.configService.get<string>("storage.supabaseUrl")!,
      this.configService.get<string>("storage.supabaseServiceRoleKey")!,
    );
    this.bucket = this.configService.get<string>("storage.supabaseBucket")!;
  }

  async upload(input: UploadFileInput): Promise<UploadFileOutput> {
    const fileName = `${randomBytes(16).toString("hex")}${extname(input.originalName)}`;
    const path = `${input.folder}/${fileName}`;

    const { error } = await this.client.storage.from(this.bucket).upload(path, input.buffer, {
      contentType: input.mimeType,
      upsert: false,
    });
    if (error) {
      throw new Error(`Falha ao enviar arquivo para o Supabase Storage: ${error.message}`);
    }

    const { data } = this.client.storage.from(this.bucket).getPublicUrl(path);
    return { url: data.publicUrl, path };
  }
}
