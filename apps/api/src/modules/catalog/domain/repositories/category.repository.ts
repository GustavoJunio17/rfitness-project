export const CATEGORY_REPOSITORY = Symbol("CATEGORY_REPOSITORY");

export interface Category {
  id: string;
  gymId: string;
  name: string;
}

export interface CategoryRepository {
  create(gymId: string, name: string): Promise<Category>;
  findAll(gymId: string): Promise<Category[]>;
  findById(gymId: string, id: string): Promise<Category | null>;
  update(gymId: string, id: string, name: string): Promise<Category>;
  delete(gymId: string, id: string): Promise<void>;
}
