import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../../shared/prisma/prisma.service";
import type { UserRepository, UserWithRoles } from "../../domain/repositories/user.repository";

@Injectable()
export class PrismaUserRepository implements UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByGymSlugAndEmail(gymSlug: string, email: string): Promise<UserWithRoles | null> {
    const user = await this.prisma.user.findFirst({
      where: { email, gym: { slug: gymSlug } },
      include: { roles: { include: { role: true } } },
    });
    return user ? this.toDomain(user) : null;
  }

  async findById(id: string): Promise<UserWithRoles | null> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { roles: { include: { role: true } } },
    });
    return user ? this.toDomain(user) : null;
  }

  async updateLastLogin(id: string): Promise<void> {
    await this.prisma.user.update({
      where: { id },
      data: { lastLoginAt: new Date() },
    });
  }

  private toDomain(user: {
    id: string;
    gymId: string;
    name: string;
    email: string;
    passwordHash: string;
    status: string;
    roles: { role: { name: string } }[];
  }): UserWithRoles {
    return {
      id: user.id,
      gymId: user.gymId,
      name: user.name,
      email: user.email,
      passwordHash: user.passwordHash,
      status: user.status as UserWithRoles["status"],
      roles: user.roles.map((r) => r.role.name),
    };
  }
}
