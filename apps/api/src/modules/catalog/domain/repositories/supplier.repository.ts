export const SUPPLIER_REPOSITORY = Symbol("SUPPLIER_REPOSITORY");

export interface Supplier {
  id: string;
  gymId: string;
  name: string;
  cnpj: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
}

export interface SupplierInput {
  name: string;
  cnpj?: string;
  phone?: string;
  email?: string;
  address?: string;
}

export interface SupplierRepository {
  create(gymId: string, input: SupplierInput): Promise<Supplier>;
  findAll(gymId: string): Promise<Supplier[]>;
  findById(gymId: string, id: string): Promise<Supplier | null>;
  update(gymId: string, id: string, input: SupplierInput): Promise<Supplier>;
  delete(gymId: string, id: string): Promise<void>;
}
