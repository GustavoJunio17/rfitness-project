import { Prisma } from "@prisma/client";
import { conflictError, notFoundError, validationError } from "@rfitness/core";
import { prisma } from "../../db";

export interface NamedDto {
  id: string;
  name: string;
  productCount?: number;
}

export interface SupplierDto extends NamedDto {
  cnpj: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
}

type SimpleEntity = "category" | "brand";

function duplicateName(entity: SimpleEntity | "supplier"): never {
  const label = entity === "category" ? "categoria" : entity === "brand" ? "marca" : "fornecedor";
  throw conflictError(`Já existe um(a) ${label} com esse nome nesta academia.`);
}

export async function listCategories(gymId: string): Promise<NamedDto[]> {
  const categories = await prisma.category.findMany({
    where: { gymId },
    orderBy: { name: "asc" },
    include: { _count: { select: { products: true } } },
  });
  return categories.map((category) => ({
    id: category.id,
    name: category.name,
    productCount: category._count.products,
  }));
}

export async function listBrands(gymId: string): Promise<NamedDto[]> {
  const brands = await prisma.brand.findMany({
    where: { gymId },
    orderBy: { name: "asc" },
    include: { _count: { select: { variants: true } } },
  });
  return brands.map((brand) => ({
    id: brand.id,
    name: brand.name,
    productCount: brand._count.variants,
  }));
}

export async function listSuppliers(gymId: string): Promise<SupplierDto[]> {
  const suppliers = await prisma.supplier.findMany({
    where: { gymId },
    orderBy: { name: "asc" },
    include: { _count: { select: { products: true } } },
  });
  return suppliers.map((supplier) => ({
    id: supplier.id,
    name: supplier.name,
    cnpj: supplier.cnpj,
    phone: supplier.phone,
    email: supplier.email,
    address: supplier.address,
    productCount: supplier._count.products,
  }));
}

function assertName(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length === 0) throw validationError("O nome é obrigatório.");
  return trimmed;
}

export async function createCategory(gymId: string, name: string): Promise<NamedDto> {
  try {
    const category = await prisma.category.create({ data: { gymId, name: assertName(name) } });
    return { id: category.id, name: category.name };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      duplicateName("category");
    }
    throw error;
  }
}

export async function updateCategory(gymId: string, id: string, name: string): Promise<NamedDto> {
  const { count } = await prisma.category.updateMany({
    where: { id, gymId },
    data: { name: assertName(name) },
  });
  if (count === 0) throw notFoundError("Categoria não encontrada.");
  const category = await prisma.category.findUniqueOrThrow({ where: { id } });
  return { id: category.id, name: category.name };
}

export async function deleteCategory(gymId: string, id: string): Promise<void> {
  const category = await prisma.category.findFirst({
    where: { id, gymId },
    include: { _count: { select: { products: true } } },
  });
  if (!category) throw notFoundError("Categoria não encontrada.");
  if (category._count.products > 0) {
    throw conflictError("Não é possível excluir: existem produtos nesta categoria.");
  }
  await prisma.category.delete({ where: { id } });
}

export async function createBrand(gymId: string, name: string): Promise<NamedDto> {
  try {
    const brand = await prisma.brand.create({ data: { gymId, name: assertName(name) } });
    return { id: brand.id, name: brand.name };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      duplicateName("brand");
    }
    throw error;
  }
}

export async function updateBrand(gymId: string, id: string, name: string): Promise<NamedDto> {
  const { count } = await prisma.brand.updateMany({
    where: { id, gymId },
    data: { name: assertName(name) },
  });
  if (count === 0) throw notFoundError("Marca não encontrada.");
  const brand = await prisma.brand.findUniqueOrThrow({ where: { id } });
  return { id: brand.id, name: brand.name };
}

export async function deleteBrand(gymId: string, id: string): Promise<void> {
  const brand = await prisma.brand.findFirst({
    where: { id, gymId },
    include: { _count: { select: { variants: true } } },
  });
  if (!brand) throw notFoundError("Marca não encontrada.");
  if (brand._count.variants > 0) {
    throw conflictError("Não é possível excluir: existem SKUs desta marca.");
  }
  await prisma.brand.delete({ where: { id } });
}

export interface SupplierWriteInput {
  name: string;
  cnpj?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
}

export async function createSupplier(gymId: string, input: SupplierWriteInput): Promise<SupplierDto> {
  try {
    const supplier = await prisma.supplier.create({
      data: {
        gymId,
        name: assertName(input.name),
        cnpj: input.cnpj ?? null,
        phone: input.phone ?? null,
        email: input.email ?? null,
        address: input.address ?? null,
      },
    });
    return {
      id: supplier.id,
      name: supplier.name,
      cnpj: supplier.cnpj,
      phone: supplier.phone,
      email: supplier.email,
      address: supplier.address,
    };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      duplicateName("supplier");
    }
    throw error;
  }
}

export async function updateSupplier(
  gymId: string,
  id: string,
  input: Partial<SupplierWriteInput>,
): Promise<SupplierDto> {
  const { count } = await prisma.supplier.updateMany({
    where: { id, gymId },
    data: {
      ...(input.name !== undefined ? { name: assertName(input.name) } : {}),
      ...(input.cnpj !== undefined ? { cnpj: input.cnpj } : {}),
      ...(input.phone !== undefined ? { phone: input.phone } : {}),
      ...(input.email !== undefined ? { email: input.email } : {}),
      ...(input.address !== undefined ? { address: input.address } : {}),
    },
  });
  if (count === 0) throw notFoundError("Fornecedor não encontrado.");

  const supplier = await prisma.supplier.findUniqueOrThrow({ where: { id } });
  return {
    id: supplier.id,
    name: supplier.name,
    cnpj: supplier.cnpj,
    phone: supplier.phone,
    email: supplier.email,
    address: supplier.address,
  };
}

export async function deleteSupplier(gymId: string, id: string): Promise<void> {
  const supplier = await prisma.supplier.findFirst({
    where: { id, gymId },
    include: { _count: { select: { products: true } } },
  });
  if (!supplier) throw notFoundError("Fornecedor não encontrado.");
  if (supplier._count.products > 0) {
    throw conflictError("Não é possível excluir: existem produtos deste fornecedor.");
  }
  await prisma.supplier.delete({ where: { id } });
}
