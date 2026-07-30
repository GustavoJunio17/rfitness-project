import { defineRoute } from "@/server/http/route";
import { studentSchema, uuidParam } from "@/server/http/schemas";
import { studentsService } from "@/server/modules/students/students.repository";

export const GET = defineRoute({
  params: uuidParam,
  handler: async ({ auth, params }) => studentsService.getStudent(auth.gymId, params.id),
});

export const PUT = defineRoute({
  roles: ["ADMIN", "RECEPTION"],
  params: uuidParam,
  body: studentSchema.partial(),
  handler: async ({ auth, params, body }) => studentsService.updateStudent(auth.gymId, params.id, body),
});

export const DELETE = defineRoute({
  roles: ["ADMIN", "RECEPTION"],
  params: uuidParam,
  handler: async ({ auth, params }) => {
    await studentsService.deleteStudent(auth.gymId, params.id);
    return { ok: true };
  },
});
