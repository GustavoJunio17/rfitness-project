import { defineRoute } from "@/server/http/route";
import { goalSchema, uuidParam } from "@/server/http/schemas";
import { studentsService } from "@/server/modules/students/students.repository";

export const POST = defineRoute({
  roles: ["ADMIN", "RECEPTION", "TRAINER"],
  params: uuidParam,
  body: goalSchema,
  handler: async ({ auth, params, body }) => studentsService.addGoal(auth.gymId, params.id, body),
});
