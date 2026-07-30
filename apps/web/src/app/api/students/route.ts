import { z } from "zod";
import { defineRoute } from "@/server/http/route";
import { limitQuery, studentSchema, studentStatusSchema } from "@/server/http/schemas";
import { studentsService } from "@/server/modules/students/students.repository";

export const GET = defineRoute({
  query: z.object({
    search: z.string().trim().max(120).optional(),
    status: studentStatusSchema.optional(),
    limit: limitQuery,
  }),
  handler: async ({ auth, query }) => studentsService.listStudents(auth.gymId, query),
});

export const POST = defineRoute({
  roles: ["ADMIN", "RECEPTION"],
  body: studentSchema,
  handler: async ({ auth, body }) => studentsService.createStudent(auth.gymId, body),
});
