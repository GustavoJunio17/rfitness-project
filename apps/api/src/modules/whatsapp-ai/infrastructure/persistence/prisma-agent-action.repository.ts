import { Injectable } from "@nestjs/common";
import { Prisma } from "@rfitness/database";
import { PrismaService } from "../../../../shared/prisma/prisma.service";
import type { AgentActionRepository, LogAgentActionInput } from "../../domain/repositories/agent-action.repository";

@Injectable()
export class PrismaAgentActionRepository implements AgentActionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async log(input: LogAgentActionInput): Promise<void> {
    await this.prisma.agentAction.create({
      data: {
        action: input.action,
        input: (input.input ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        output: (input.output ?? Prisma.JsonNull) as Prisma.InputJsonValue,
      },
    });
  }
}
