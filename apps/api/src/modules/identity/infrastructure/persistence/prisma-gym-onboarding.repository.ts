import { ConflictException, Injectable } from "@nestjs/common";
import { PrismaService } from "../../../../shared/prisma/prisma.service";
import type {
  GymOnboardingRepository,
  RegisterGymInput,
  RegisterGymOutput,
} from "../../domain/repositories/gym-onboarding.repository";

const DEFAULT_ADMIN_ROLE = "ADMIN";

// Every gym gets the standard role catalog available for assigning to future
// employees (via a user-management endpoint from a later phase) — mirrors the
// role set the demo seed creates, so RBAC (@Roles(...)) is meaningful for every
// tenant, not just the seeded demo gym.
const DEFAULT_NON_ADMIN_ROLES = ["RECEPTION", "STOCKIST", "FINANCE", "TRAINER"] as const;

@Injectable()
export class PrismaGymOnboardingRepository implements GymOnboardingRepository {
  constructor(private readonly prisma: PrismaService) {}

  async slugExists(slug: string): Promise<boolean> {
    const gym = await this.prisma.gym.findUnique({ where: { slug } });
    return gym !== null;
  }

  async registerGymWithAdmin(input: RegisterGymInput): Promise<RegisterGymOutput> {
    if (await this.slugExists(input.gymSlug)) {
      throw new ConflictException("Já existe uma academia com este identificador.");
    }

    return this.prisma.$transaction(async (tx) => {
      const gym = await tx.gym.create({
        data: { name: input.gymName, slug: input.gymSlug },
      });

      const adminRole = await tx.role.create({
        data: {
          gymId: gym.id,
          name: DEFAULT_ADMIN_ROLE,
          isSystem: true,
          description: "Administrador da academia — acesso total.",
        },
      });

      const user = await tx.user.create({
        data: {
          gymId: gym.id,
          name: input.adminName,
          email: input.adminEmail,
          passwordHash: input.adminPasswordHash,
        },
      });

      await tx.userRole.create({
        data: { userId: user.id, roleId: adminRole.id },
      });

      await tx.role.createMany({
        data: DEFAULT_NON_ADMIN_ROLES.map((name) => ({
          gymId: gym.id,
          name,
          isSystem: true,
        })),
      });

      return { gymId: gym.id, userId: user.id };
    });
  }
}
