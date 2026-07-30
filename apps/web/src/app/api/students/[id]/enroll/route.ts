import { defineRoute } from "@/server/http/route";
import { enrollSchema, uuidParam } from "@/server/http/schemas";
import { studentsService } from "@/server/modules/students/students.repository";

export const POST = defineRoute({
  roles: ["ADMIN", "RECEPTION"],
  params: uuidParam,
  body: enrollSchema,
  handler: async ({ auth, params, body }) => studentsService.enrollStudent(auth.gymId, params.id, body),
});
