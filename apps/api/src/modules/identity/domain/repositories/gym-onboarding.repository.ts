export const GYM_ONBOARDING_REPOSITORY = Symbol("GYM_ONBOARDING_REPOSITORY");

export interface RegisterGymInput {
  gymName: string;
  gymSlug: string;
  adminName: string;
  adminEmail: string;
  adminPasswordHash: string;
}

export interface RegisterGymOutput {
  gymId: string;
  userId: string;
}

export interface GymOnboardingRepository {
  slugExists(slug: string): Promise<boolean>;
  registerGymWithAdmin(input: RegisterGymInput): Promise<RegisterGymOutput>;
}
