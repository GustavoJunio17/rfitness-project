export const BRAND_REPOSITORY = Symbol("BRAND_REPOSITORY");

export interface Brand {
  id: string;
  gymId: string;
  name: string;
}

export interface BrandRepository {
  create(gymId: string, name: string): Promise<Brand>;
  findAll(gymId: string): Promise<Brand[]>;
  findById(gymId: string, id: string): Promise<Brand | null>;
  update(gymId: string, id: string, name: string): Promise<Brand>;
  delete(gymId: string, id: string): Promise<void>;
}
