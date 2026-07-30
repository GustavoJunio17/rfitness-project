import { z } from "zod";
import { defineRoute } from "@/server/http/route";
import { studentStatusSchema, uuidParam } from "@/server/http/schemas";
import { studentsService } from "@/server/modules/students/students.repository";

export const PATCH = defineRoute({
  roles: ["ADMIN", "RECEPTION"],
  params: uuidParam,
  body: z.object({ status: studentStatusSchema }),
  handler: async ({ auth, params, body }) =>
    studentsService.updateStatus(auth.gymId, params.id, body.status),
});
