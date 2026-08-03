import { defineRoute } from "@/server/http/route";
import { updatePlatformGymSchema, uuidParam } from "@/server/http/schemas";
import {
  deletePlatformGym,
  getPlatformGym,
  updatePlatformGym,
} from "@/server/modules/platform/platform.service";

export const GET = defineRoute({
  scope: "platform",
  params: uuidParam,
  handler: async ({ params }) => getPlatformGym(params.id),
});

export const PATCH = defineRoute({
  scope: "platform",
  params: uuidParam,
  body: updatePlatformGymSchema,
  handler: async ({ auth, params, body }) => {
    await updatePlatformGym(auth, params.id, body);
  },
});

/** Exclui a academia e, por cascata, alunos, estoque e histórico dela. */
export const DELETE = defineRoute({
  scope: "platform",
  params: uuidParam,
  handler: async ({ auth, params }) => {
    await deletePlatformGym(auth, params.id);
  },
});
