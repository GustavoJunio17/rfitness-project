import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { randomBytes } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import { extname, join } from "path";
import type { StorageRepository, UploadFileInput, UploadFileOutput } from "./storage.repository";

@Injectable()
export class LocalDiskStorageAdapter implements StorageRepository {
  constructor(private readonly configService: ConfigService) {}

  async upload(input: UploadFileInput): Promise<UploadFileOutput> {
    const uploadsDir = this.configService.get<string>("storage.localUploadsDir")!;
    const folderPath = join(process.cwd(), uploadsDir, input.folder);
    await mkdir(folderPath, { recursive: true });

    const fileName = `${randomBytes(16).toString("hex")}${extname(input.originalName)}`;
    await writeFile(join(folderPath, fileName), input.buffer);

    const publicBaseUrl = this.configService.get<string>("storage.localPublicBaseUrl")!;
    const relativePath = `${input.folder}/${fileName}`;
    return {
      url: `${publicBaseUrl}/${relativePath}`,
      path: relativePath,
    };
  }
}
