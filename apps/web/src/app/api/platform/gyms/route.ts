import { defineRoute } from "@/server/http/route";
import { createPlatformGymSchema } from "@/server/http/schemas";
import { createPlatformGym, listPlatformGyms } from "@/server/modules/platform/platform.service";

export const GET = defineRoute({
  scope: "platform",
  handler: async () => listPlatformGyms(),
});

export const POST = defineRoute({
  scope: "platform",
  body: createPlatformGymSchema,
  handler: async ({ auth, body }) => createPlatformGym(auth, body),
});
