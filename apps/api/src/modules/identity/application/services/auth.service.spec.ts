import { UnauthorizedException } from "@nestjs/common";
import { AuthService } from "./auth.service";
import type { UserRepository, UserWithRoles } from "../../domain/repositories/user.repository";
import type { RefreshTokenRepository } from "../../domain/repositories/refresh-token.repository";
import type { GymOnboardingRepository } from "../../domain/repositories/gym-onboarding.repository";
import type { PasswordHasherService } from "./password-hasher.service";
import type { TokenService } from "./token.service";
import type { AuditLogService } from "../../../audit/audit-log.service";

function buildUser(overrides: Partial<UserWithRoles> = {}): UserWithRoles {
  return {
    id: "user-1",
    gymId: "gym-1",
    name: "Admin",
    email: "admin@rfitness-demo.com",
    passwordHash: "hashed-password",
    status: "ACTIVE",
    roles: ["ADMIN"],
    ...overrides,
  };
}

describe("AuthService", () => {
  let gymOnboardingRepository: jest.Mocked<GymOnboardingRepository>;
  let userRepository: jest.Mocked<UserRepository>;
  let refreshTokenRepository: jest.Mocked<RefreshTokenRepository>;
  let passwordHasher: jest.Mocked<PasswordHasherService>;
  let tokenService: jest.Mocked<TokenService>;
  let auditLog: jest.Mocked<AuditLogService>;
  let authService: AuthService;

  beforeEach(() => {
    gymOnboardingRepository = {
      slugExists: jest.fn(),
      registerGymWithAdmin: jest.fn(),
    };
    userRepository = {
      findByGymSlugAndEmail: jest.fn(),
      findById: jest.fn(),
      updateLastLogin: jest.fn(),
    };
    refreshTokenRepository = {
      create: jest.fn(),
      findByTokenHash: jest.fn(),
      revoke: jest.fn(),
    };
    passwordHasher = {
      hash: jest.fn(),
      compare: jest.fn(),
    } as unknown as jest.Mocked<PasswordHasherService>;
    tokenService = {
      signAccessToken: jest.fn().mockReturnValue("access-token"),
      generateRefreshToken: jest.fn().mockReturnValue({
        value: "refresh-value",
        hash: "refresh-hash",
        expiresAt: new Date(Date.now() + 1000 * 60),
      }),
      hashRefreshToken: jest.fn().mockReturnValue("refresh-hash"),
    } as unknown as jest.Mocked<TokenService>;
    auditLog = { log: jest.fn() } as unknown as jest.Mocked<AuditLogService>;

    authService = new AuthService(
      gymOnboardingRepository,
      userRepository,
      refreshTokenRepository,
      passwordHasher,
      tokenService,
      auditLog,
    );
  });

  describe("login", () => {
    it("returns tokens for valid credentials", async () => {
      const user = buildUser();
      userRepository.findByGymSlugAndEmail.mockResolvedValue(user);
      passwordHasher.compare.mockResolvedValue(true);

      const result = await authService.login(
        { gymSlug: "rfitness-demo", email: user.email, password: "Rfitness@123" },
        {},
      );

      expect(result.accessToken).toBe("access-token");
      expect(result.refreshToken).toBe("refresh-value");
      expect(result.user.email).toBe(user.email);
      expect(userRepository.updateLastLogin).toHaveBeenCalledWith(user.id);
      expect(auditLog.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: "auth.login", gymId: user.gymId }),
      );
    });

    it("rejects when the user does not exist", async () => {
      userRepository.findByGymSlugAndEmail.mockResolvedValue(null);

      await expect(
        authService.login({ gymSlug: "rfitness-demo", email: "ghost@x.com", password: "any" }, {}),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it("rejects when the password does not match", async () => {
      userRepository.findByGymSlugAndEmail.mockResolvedValue(buildUser());
      passwordHasher.compare.mockResolvedValue(false);

      await expect(
        authService.login({ gymSlug: "rfitness-demo", email: "admin@rfitness-demo.com", password: "wrong" }, {}),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it("rejects inactive users even with a correct password", async () => {
      userRepository.findByGymSlugAndEmail.mockResolvedValue(buildUser({ status: "SUSPENDED" }));

      await expect(
        authService.login({ gymSlug: "rfitness-demo", email: "admin@rfitness-demo.com", password: "any" }, {}),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(passwordHasher.compare).not.toHaveBeenCalled();
    });
  });

  describe("refresh", () => {
    it("rotates a valid refresh token", async () => {
      const user = buildUser();
      refreshTokenRepository.findByTokenHash.mockResolvedValue({
        id: "rt-1",
        userId: user.id,
        tokenHash: "refresh-hash",
        expiresAt: new Date(Date.now() + 1000 * 60),
        revokedAt: null,
      });
      userRepository.findById.mockResolvedValue(user);

      const result = await authService.refresh("refresh-value", {});

      expect(refreshTokenRepository.revoke).toHaveBeenCalledWith("rt-1");
      expect(result.accessToken).toBe("access-token");
    });

    it("rejects an expired refresh token", async () => {
      refreshTokenRepository.findByTokenHash.mockResolvedValue({
        id: "rt-1",
        userId: "user-1",
        tokenHash: "refresh-hash",
        expiresAt: new Date(Date.now() - 1000),
        revokedAt: null,
      });

      await expect(authService.refresh("refresh-value", {})).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it("rejects an already revoked refresh token", async () => {
      refreshTokenRepository.findByTokenHash.mockResolvedValue({
        id: "rt-1",
        userId: "user-1",
        tokenHash: "refresh-hash",
        expiresAt: new Date(Date.now() + 1000 * 60),
        revokedAt: new Date(),
      });

      await expect(authService.refresh("refresh-value", {})).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it("rejects an unknown refresh token", async () => {
      refreshTokenRepository.findByTokenHash.mockResolvedValue(null);

      await expect(authService.refresh("does-not-exist", {})).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe("registerGym", () => {
    it("creates the gym/admin and returns tokens", async () => {
      passwordHasher.hash.mockResolvedValue("hashed-password");
      gymOnboardingRepository.registerGymWithAdmin.mockResolvedValue({ gymId: "gym-1", userId: "user-1" });
      userRepository.findById.mockResolvedValue(buildUser());

      const result = await authService.registerGym(
        {
          gymName: "Academia X",
          gymSlug: "academia-x",
          adminName: "Admin",
          adminEmail: "admin@rfitness-demo.com",
          adminPassword: "SenhaForte@123",
        },
        {},
      );

      expect(gymOnboardingRepository.registerGymWithAdmin).toHaveBeenCalledWith(
        expect.objectContaining({ gymSlug: "academia-x", adminPasswordHash: "hashed-password" }),
      );
      expect(result.accessToken).toBe("access-token");
      expect(auditLog.log).toHaveBeenCalledWith(expect.objectContaining({ action: "auth.register_gym" }));
    });
  });
});
