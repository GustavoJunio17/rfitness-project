export interface AuthenticatedUser {
  sub: string; // userId
  gymId: string;
  email: string;
  roles: string[];
}
