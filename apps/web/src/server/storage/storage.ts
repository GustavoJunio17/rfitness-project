import { validationError } from "@rfitness/core";
import { getEnv } from "../env";
import { getSupabaseAdmin } from "../supabase/admin";

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);

export function assertUploadableImage(file: { size: number; type: string }): void {
  if (!ALLOWED_MIME.has(file.type)) {
    throw validationError("Formato inválido. Envie uma imagem JPEG, PNG, WebP ou AVIF.");
  }
  if (file.size > MAX_PHOTO_BYTES) {
    throw validationError("A imagem deve ter no máximo 5 MB.");
  }
}

/**
 * Sobe a foto de um SKU no Supabase Storage e devolve a URL pública.
 *
 * O bucket precisa existir e ser público (leitura anônima) — a escrita passa
 * pelo service role, então nunca há upload direto do browser.
 */
export async function uploadVariantPhoto(input: {
  gymId: string;
  variantId: string;
  file: File;
}): Promise<string> {
  assertUploadableImage(input.file);

  const env = getEnv();
  const supabase = getSupabaseAdmin();
  const extension = input.file.type.split("/")[1] ?? "jpg";
  const path = `${input.gymId}/variants/${input.variantId}-${Date.now()}.${extension}`;

  const { error } = await supabase.storage.from(env.SUPABASE_STORAGE_BUCKET).upload(path, input.file, {
    contentType: input.file.type,
    upsert: true,
  });

  if (error) {
    throw validationError(`Falha ao enviar a imagem: ${error.message}`);
  }

  const { data } = supabase.storage.from(env.SUPABASE_STORAGE_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
