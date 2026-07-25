import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@rfitness/database";
import { PrismaService } from "../../../../shared/prisma/prisma.service";
import type { Brand, BrandRepository } from "../../domain/repositories/brand.repository";

@Injectable()
export class PrismaBrandRepository implements BrandRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(gymId: string, name: string): Promise<Brand> {
    return this.prisma.brand.create({ data: { gymId, name } });
  }

  findAll(gymId: string): Promise<Brand[]> {
    return this.prisma.brand.findMany({ where: { gymId }, orderBy: { name: "asc" } });
  }

  findById(gymId: string, id: string): Promise<Brand | null> {
    return this.prisma.brand.findFirst({ where: { id, gymId } });
  }

  async update(gymId: string, id: string, name: string): Promise<Brand> {
    await this.assertExists(gymId, id);
    return this.prisma.brand.update({ where: { id }, data: { name } });
  }

  async delete(gymId: string, id: string): Promise<void> {
    await this.assertExists(gymId, id);
    try {
      await this.prisma.brand.delete({ where: { id } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
        throw new ConflictException("Não é possível excluir uma marca com SKUs vinculados.");
      }
      throw error;
    }
  }

  private async assertExists(gymId: string, id: string): Promise<void> {
    const brand = await this.findById(gymId, id);
    if (!brand) throw new NotFoundException("Marca não encontrada.");
  }
}
