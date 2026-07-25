import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import {
  GYM_ONBOARDING_REPOSITORY,
  GymOnboardingRepository,
} from "../../domain/repositories/gym-onboarding.repository";
import { USER_REPOSITORY, UserRepository, UserWithRoles } from "../../domain/repositories/user.repository";
import {
  REFRESH_TOKEN_REPOSITORY,
  RefreshTokenRepository,
} from "../../domain/repositories/refresh-token.repository";
import { PasswordHasherService } from "./password-hasher.service";
import { TokenService } from "./token.service";
import { RegisterGymDto } from "../dto/register-gym.dto";
import { LoginDto } from "../dto/login.dto";
import { AuditLogService } from "../../../audit/audit-log.service";
import type { AuthResponseDto } from "../dto/auth-response.dto";

export interface RequestMeta {
  ip?: string;
  userAgent?: string;
}

@Injectable()
export class AuthService {
  constructor(
    @Inject(GYM_ONBOARDING_REPOSITORY) private readonly gymOnboardingRepository: GymOnboardingRepository,
    @Inject(USER_REPOSITORY) private readonly userRepository: UserRepository,
    @Inject(REFRESH_TOKEN_REPOSITORY) private readonly refreshTokenRepository: RefreshTokenRepository,
    private readonly passwordHasher: PasswordHasherService,
    private readonly tokenService: TokenService,
    private readonly auditLog: AuditLogService,
  ) {}

  async registerGym(dto: RegisterGymDto, meta: RequestMeta): Promise<AuthResponseDto> {
    const passwordHash = await this.passwordHasher.hash(dto.adminPassword);
    const { gymId, userId } = await this.gymOnboardingRepository.registerGymWithAdmin({
      gymName: dto.gymName,
      gymSlug: dto.gymSlug,
      adminName: dto.adminName,
      adminEmail: dto.adminEmail,
      adminPasswordHash: passwordHash,
    });

    await this.auditLog.log({
      gymId,
      userId,
      action: "auth.register_gym",
      entityType: "Gym",
      entityId: gymId,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new UnauthorizedException("Falha ao criar usuário administrador.");
    }
    return this.issueTokens(user, meta);
  }

  async login(dto: LoginDto, meta: RequestMeta): Promise<AuthResponseDto> {
    const user = await this.userRepository.findByGymSlugAndEmail(dto.gymSlug, dto.email);
    if (!user || user.status !== "ACTIVE") {
      throw new UnauthorizedException("Credenciais inválidas.");
    }

    const passwordMatches = await this.passwordHasher.compare(dto.password, user.passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedException("Credenciais inválidas.");
    }

    await this.userRepository.updateLastLogin(user.id);
    await this.auditLog.log({
      gymId: user.gymId,
      userId: user.id,
      action: "auth.login",
      entityType: "User",
      entityId: user.id,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    return this.issueTokens(user, meta);
  }

  async refresh(refreshTokenValue: string, meta: RequestMeta): Promise<AuthResponseDto> {
    const tokenHash = this.tokenService.hashRefreshToken(refreshTokenValue);
    const stored = await this.refreshTokenRepository.findByTokenHash(tokenHash);

    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException("Sessão expirada. Faça login novamente.");
    }

    await this.refreshTokenRepository.revoke(stored.id);

    const user = await this.userRepository.findById(stored.userId);
    if (!user || user.status !== "ACTIVE") {
      throw new UnauthorizedException("Usuário inválido.");
    }

    await this.auditLog.log({
      gymId: user.gymId,
      userId: user.id,
      action: "auth.refresh",
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    return this.issueTokens(user, meta);
  }

  async logout(refreshTokenValue: string): Promise<void> {
    const tokenHash = this.tokenService.hashRefreshToken(refreshTokenValue);
    const stored = await this.refreshTokenRepository.findByTokenHash(tokenHash);
    if (stored && !stored.revokedAt) {
      await this.refreshTokenRepository.revoke(stored.id);
    }
  }

  private async issueTokens(user: UserWithRoles, meta: RequestMeta): Promise<AuthResponseDto> {
    const accessToken = this.tokenService.signAccessToken({
      sub: user.id,
      gymId: user.gymId,
      email: user.email,
      roles: user.roles,
    });

    const refreshToken = this.tokenService.generateRefreshToken();
    await this.refreshTokenRepository.create({
      userId: user.id,
      tokenHash: refreshToken.hash,
      expiresAt: refreshToken.expiresAt,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    return {
      accessToken,
      refreshToken: refreshToken.value,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        gymId: user.gymId,
        roles: user.roles,
      },
    };
  }
}
