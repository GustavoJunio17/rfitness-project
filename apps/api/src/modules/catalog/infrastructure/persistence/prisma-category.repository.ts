import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@rfitness/database";
import { PrismaService } from "../../../../shared/prisma/prisma.service";
import type { Category, CategoryRepository } from "../../domain/repositories/category.repository";

@Injectable()
export class PrismaCategoryRepository implements CategoryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(gymId: string, name: string): Promise<Category> {
    return this.prisma.category.create({ data: { gymId, name } });
  }

  findAll(gymId: string): Promise<Category[]> {
    return this.prisma.category.findMany({ where: { gymId }, orderBy: { name: "asc" } });
  }

  findById(gymId: string, id: string): Promise<Category | null> {
    return this.prisma.category.findFirst({ where: { id, gymId } });
  }

  async update(gymId: string, id: string, name: string): Promise<Category> {
    await this.assertExists(gymId, id);
    return this.prisma.category.update({ where: { id }, data: { name } });
  }

  async delete(gymId: string, id: string): Promise<void> {
    await this.assertExists(gymId, id);
    try {
      await this.prisma.category.delete({ where: { id } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
        throw new ConflictException("Não é possível excluir uma categoria com produtos vinculados.");
      }
      throw error;
    }
  }

  private async assertExists(gymId: string, id: string): Promise<void> {
    const category = await this.findById(gymId, id);
    if (!category) throw new NotFoundException("Categoria não encontrada.");
  }
}
