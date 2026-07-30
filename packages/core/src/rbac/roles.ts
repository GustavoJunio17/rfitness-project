import { forbiddenError } from "../shared/errors";

export const ROLES = ["ADMIN", "RECEPTION", "STOCKIST", "FINANCE", "TRAINER"] as const;
export type Role = (typeof ROLES)[number];

/** Lista de exigidos vazia = qualquer usuário autenticado da academia. */
export function hasAnyRole(userRoles: readonly string[], required: readonly Role[]): boolean {
  if (required.length === 0) return true;
  return userRoles.some((role) => (required as readonly string[]).includes(role));
}

export function assertRole(userRoles: readonly string[], required: readonly Role[]): void {
  if (!hasAnyRole(userRoles, required)) {
    throw forbiddenError("Seu perfil não tem permissão para esta ação.");
  }
}

export function isRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
}
