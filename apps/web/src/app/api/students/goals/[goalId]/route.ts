import { z } from "zod";
import { defineRoute } from "@/server/http/route";
import { updateGoalSchema } from "@/server/http/schemas";
import { studentsService } from "@/server/modules/students/students.repository";

export const PATCH = defineRoute({
  roles: ["ADMIN", "RECEPTION", "TRAINER"],
  params: z.object({ goalId: z.string().uuid() }),
  body: updateGoalSchema,
  handler: async ({ auth, params, body }) => studentsService.updateGoal(auth.gymId, params.goalId, body),
});
