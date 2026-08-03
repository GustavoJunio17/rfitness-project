import { defineRoute } from "@/server/http/route";
import { updateManagerAccountSchema, uuidParam } from "@/server/http/schemas";
import {
  deleteManagerAccount,
  getManagerAccount,
  updateManagerAccount,
} from "@/server/modules/platform/platform.service";

export const GET = defineRoute({
  scope: "platform",
  params: uuidParam,
  handler: async ({ params }) => getManagerAccount(params.id),
});

/** Editar dados e mudar status: liberar, recusar, suspender, reativar. */
export const PATCH = defineRoute({
  scope: "platform",
  params: uuidParam,
  body: updateManagerAccountSchema,
  handler: async ({ auth, params, body }) => updateManagerAccount(auth, params.id, body),
});

export const DELETE = defineRoute({
  scope: "platform",
  params: uuidParam,
  handler: async ({ auth, params }) => {
    await deleteManagerAccount(auth, params.id);
  },
});
