import { validationError } from "@rfitness/core";
import { defineRoute } from "@/server/http/route";
import { uuidParam } from "@/server/http/schemas";
import { setVariantPhoto } from "@/server/modules/catalog/catalog.service";

/**
 * Upload multipart — não passa pelo `body` do defineRoute (que espera JSON);
 * o arquivo é lido direto do FormData da request.
 */
export const POST = defineRoute({
  roles: ["ADMIN", "STOCKIST"],
  params: uuidParam,
  handler: async ({ auth, params, request }) => {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      throw validationError("Envie a imagem no campo 'file'.");
    }
    return setVariantPhoto(auth.gymId, params.id, file);
  },
});
