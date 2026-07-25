import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { APP_GUARD } from "@nestjs/core";
import { AuthController } from "./interface/http/auth.controller";
import { AuthService } from "./application/services/auth.service";
import { PasswordHasherService } from "./application/services/password-hasher.service";
import { TokenService } from "./application/services/token.service";
import { JwtStrategy } from "./interface/strategies/jwt.strategy";
import { JwtAuthGuard } from "./interface/guards/jwt-auth.guard";
import { RolesGuard } from "./interface/guards/roles.guard";
import { USER_REPOSITORY } from "./domain/repositories/user.repository";
import { PrismaUserRepository } from "./infrastructure/persistence/prisma-user.repository";
import { REFRESH_TOKEN_REPOSITORY } from "./domain/repositories/refresh-token.repository";
import { PrismaRefreshTokenRepository } from "./infrastructure/persistence/prisma-refresh-token.repository";
import { GYM_ONBOARDING_REPOSITORY } from "./domain/repositories/gym-onboarding.repository";
import { PrismaGymOnboardingRepository } from "./infrastructure/persistence/prisma-gym-onboarding.repository";

@Module({
  imports: [PassportModule, JwtModule.register({})],
  controllers: [AuthController],
  providers: [
    AuthService,
    PasswordHasherService,
    TokenService,
    JwtStrategy,
    { provide: USER_REPOSITORY, useClass: PrismaUserRepository },
    { provide: REFRESH_TOKEN_REPOSITORY, useClass: PrismaRefreshTokenRepository },
    { provide: GYM_ONBOARDING_REPOSITORY, useClass: PrismaGymOnboardingRepository },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
  exports: [AuthService],
})
export class IdentityModule {}
