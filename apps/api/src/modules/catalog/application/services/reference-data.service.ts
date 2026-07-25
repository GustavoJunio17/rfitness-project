import { Inject, Injectable } from "@nestjs/common";
import { CATEGORY_REPOSITORY, CategoryRepository } from "../../domain/repositories/category.repository";
import { BRAND_REPOSITORY, BrandRepository } from "../../domain/repositories/brand.repository";
import {
  SUPPLIER_REPOSITORY,
  SupplierInput,
  SupplierRepository,
} from "../../domain/repositories/supplier.repository";

@Injectable()
export class ReferenceDataService {
  constructor(
    @Inject(CATEGORY_REPOSITORY) private readonly categories: CategoryRepository,
    @Inject(BRAND_REPOSITORY) private readonly brands: BrandRepository,
    @Inject(SUPPLIER_REPOSITORY) private readonly suppliers: SupplierRepository,
  ) {}

  createCategory(gymId: string, name: string) {
    return this.categories.create(gymId, name);
  }
  listCategories(gymId: string) {
    return this.categories.findAll(gymId);
  }
  updateCategory(gymId: string, id: string, name: string) {
    return this.categories.update(gymId, id, name);
  }
  deleteCategory(gymId: string, id: string) {
    return this.categories.delete(gymId, id);
  }

  createBrand(gymId: string, name: string) {
    return this.brands.create(gymId, name);
  }
  listBrands(gymId: string) {
    return this.brands.findAll(gymId);
  }
  updateBrand(gymId: string, id: string, name: string) {
    return this.brands.update(gymId, id, name);
  }
  deleteBrand(gymId: string, id: string) {
    return this.brands.delete(gymId, id);
  }

  createSupplier(gymId: string, input: SupplierInput) {
    return this.suppliers.create(gymId, input);
  }
  listSuppliers(gymId: string) {
    return this.suppliers.findAll(gymId);
  }
  updateSupplier(gymId: string, id: string, input: SupplierInput) {
    return this.suppliers.update(gymId, id, input);
  }
  deleteSupplier(gymId: string, id: string) {
    return this.suppliers.delete(gymId, id);
  }
}
