import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Cron, CronExpression } from "@nestjs/schedule";
import { StudentsService } from "../../../students/application/services/students.service";
import { WhatsAppAgentService } from "../../application/services/whatsapp-agent.service";

/**
 * Daily follow-up: students enrolled exactly N days ago (config, default 3) get
 * an automated check-in message. Running once a day and matching the exact
 * calendar day (not "N days or more") means each student is naturally
 * messaged only once, with no extra "already sent" flag needed.
 */
@Injectable()
export class FollowUpScheduler {
  private readonly logger = new Logger(FollowUpScheduler.name);

  constructor(
    private readonly studentsService: StudentsService,
    private readonly whatsAppAgentService: WhatsAppAgentService,
    private readonly configService: ConfigService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_10AM)
  async runDailyFollowUp(): Promise<void> {
    const followUpAfterDays = this.configService.get<number>("whatsapp.followUpAfterDays") ?? 3;
    const now = new Date();
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - followUpAfterDays);
    const dayEnd = new Date(dayStart.getTime() + 86_400_000);

    const students = await this.studentsService.findAllEnrolledBetween(dayStart, dayEnd);
    this.logger.log(`Enviando follow-up para ${students.length} aluno(s) matriculados há ${followUpAfterDays} dias.`);

    await Promise.all(
      students
        .filter((student) => student.whatsapp)
        .map((student) =>
          this.whatsAppAgentService
            .sendFollowUpMessage(student.gymId, student.name, student.whatsapp!)
            .catch((error) => this.logger.warn(`Falha no follow-up do aluno ${student.id}: ${error}`)),
        ),
    );
  }
}
