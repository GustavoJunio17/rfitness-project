import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@rfitness/database";
import { PrismaService } from "../../../../shared/prisma/prisma.service";
import type {
  Supplier,
  SupplierInput,
  SupplierRepository,
} from "../../domain/repositories/supplier.repository";

@Injectable()
export class PrismaSupplierRepository implements SupplierRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(gymId: string, input: SupplierInput): Promise<Supplier> {
    return this.prisma.supplier.create({ data: { gymId, ...input } });
  }

  findAll(gymId: string): Promise<Supplier[]> {
    return this.prisma.supplier.findMany({ where: { gymId }, orderBy: { name: "asc" } });
  }

  findById(gymId: string, id: string): Promise<Supplier | null> {
    return this.prisma.supplier.findFirst({ where: { id, gymId } });
  }

  async update(gymId: string, id: string, input: SupplierInput): Promise<Supplier> {
    await this.assertExists(gymId, id);
    return this.prisma.supplier.update({ where: { id }, data: input });
  }

  async delete(gymId: string, id: string): Promise<void> {
    await this.assertExists(gymId, id);
    try {
      await this.prisma.supplier.delete({ where: { id } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
        throw new ConflictException("Não é possível excluir um fornecedor com produtos vinculados.");
      }
      throw error;
    }
  }

  private async assertExists(gymId: string, id: string): Promise<void> {
    const supplier = await this.findById(gymId, id);
    if (!supplier) throw new NotFoundException("Fornecedor não encontrado.");
  }
}
