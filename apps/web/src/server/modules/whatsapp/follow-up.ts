import { prisma } from "../../db";
import { getEnv } from "../../env";
import { whatsAppService } from "./whatsapp.wiring";

export interface FollowUpResult {
  candidates: number;
  sent: number;
  failed: number;
}

/**
 * Follow-up dos alunos que se matricularam há exatamente N dias — mensagem única
 * perguntando como está sendo o treino. A janela é de um dia (N até N+1) para
 * que o job diário não mande a mesma mensagem repetidas vezes para o mesmo aluno.
 */
export async function runWhatsAppFollowUp(now = new Date()): Promise<FollowUpResult> {
  const env = getEnv();
  const days = env.WHATSAPP_FOLLOWUP_AFTER_DAYS;

  const windowEnd = new Date(now.getTime() - days * 86_400_000);
  const windowStart = new Date(windowEnd.getTime() - 86_400_000);

  const students = await prisma.student.findMany({
    where: {
      status: "ACTIVE",
      whatsapp: { not: null },
      createdAt: { gte: windowStart, lt: windowEnd },
      gym: { isActive: true, whatsappInstanceName: { not: null } },
    },
    select: { id: true, name: true, whatsapp: true, gymId: true },
  });

  const result: FollowUpResult = { candidates: students.length, sent: 0, failed: 0 };

  for (const student of students) {
    if (!student.whatsapp) continue;
    try {
      // eslint-disable-next-line no-await-in-loop
      await whatsAppService.sendFollowUpMessage(student.gymId, student.name, student.whatsapp);
      result.sent += 1;
    } catch (error) {
      result.failed += 1;
      // eslint-disable-next-line no-console
      console.warn(`[follow-up] falha ao enviar para o aluno ${student.id}:`, error);
    }
  }

  return result;
}
