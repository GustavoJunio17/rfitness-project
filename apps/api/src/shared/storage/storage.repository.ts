export const STORAGE_REPOSITORY = Symbol("STORAGE_REPOSITORY");

export interface UploadFileInput {
  buffer: Buffer;
  originalName: string;
  mimeType: string;
  /** Logical folder, e.g. "products" — adapters may use it as a key prefix. */
  folder: string;
}

export interface UploadFileOutput {
  url: string;
  path: string;
}

export interface StorageRepository {
  upload(input: UploadFileInput): Promise<UploadFileOutput>;
}
