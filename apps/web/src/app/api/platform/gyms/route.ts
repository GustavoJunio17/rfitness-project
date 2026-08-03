import { defineRoute } from "@/server/http/route";
import { createPlatformGymSchema, platformGymQuery } from "@/server/http/schemas";
import { createPlatformGym, listPlatformGyms } from "@/server/modules/platform/platform.service";

export const GET = defineRoute({
  scope: "platform",
  query: platformGymQuery,
  handler: async ({ query }) => listPlatformGyms(query),
});

export const POST = defineRoute({
  scope: "platform",
  body: createPlatformGymSchema,
  handler: async ({ auth, body }) => createPlatformGym(auth, body),
});
