import { defineRoute } from "@/server/http/route";
import { noteSchema, uuidParam } from "@/server/http/schemas";
import { studentsService } from "@/server/modules/students/students.repository";

export const POST = defineRoute({
  roles: ["ADMIN", "RECEPTION", "TRAINER"],
  params: uuidParam,
  body: noteSchema,
  handler: async ({ auth, params, body }) => studentsService.addNote(auth.gymId, params.id, body.content),
});
