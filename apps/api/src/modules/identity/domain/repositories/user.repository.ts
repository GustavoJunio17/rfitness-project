export const USER_REPOSITORY = Symbol("USER_REPOSITORY");

export interface UserWithRoles {
  id: string;
  gymId: string;
  name: string;
  email: string;
  passwordHash: string;
  status: "ACTIVE" | "INACTIVE" | "SUSPENDED";
  roles: string[];
}

export interface UserRepository {
  findByGymSlugAndEmail(gymSlug: string, email: string): Promise<UserWithRoles | null>;
  findById(id: string): Promise<UserWithRoles | null>;
  updateLastLogin(id: string): Promise<void>;
}
