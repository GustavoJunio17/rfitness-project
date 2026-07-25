import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import type { Request } from "express";
import { Public } from "../../../../shared/decorators/public.decorator";
import { CurrentUser } from "../../../../shared/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../../../../shared/types/authenticated-user";
import { AuthService } from "../../application/services/auth.service";
import { RegisterGymDto } from "../../application/dto/register-gym.dto";
import { LoginDto } from "../../application/dto/login.dto";
import { RefreshTokenDto } from "../../application/dto/refresh-token.dto";
import { AuthResponseDto } from "../../application/dto/auth-response.dto";

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  private meta(req: Request) {
    return { ip: req.ip, userAgent: req.headers["user-agent"] };
  }

  @Public()
  @Post("register-gym")
  @ApiOperation({ summary: "Cadastra uma nova academia (tenant) e seu usuário administrador" })
  registerGym(@Body() dto: RegisterGymDto, @Req() req: Request): Promise<AuthResponseDto> {
    return this.authService.registerGym(dto, this.meta(req));
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post("login")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Autentica um usuário e retorna access + refresh token" })
  login(@Body() dto: LoginDto, @Req() req: Request): Promise<AuthResponseDto> {
    return this.authService.login(dto, this.meta(req));
  }

  @Public()
  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Rotaciona o refresh token e emite um novo access token" })
  refresh(@Body() dto: RefreshTokenDto, @Req() req: Request): Promise<AuthResponseDto> {
    return this.authService.refresh(dto.refreshToken, this.meta(req));
  }

  @Public()
  @Post("logout")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Revoga o refresh token informado" })
  async logout(@Body() dto: RefreshTokenDto): Promise<void> {
    await this.authService.logout(dto.refreshToken);
  }

  @ApiBearerAuth()
  @Get("me")
  @ApiOperation({ summary: "Retorna o usuário autenticado (rota protegida)" })
  me(@CurrentUser() user: AuthenticatedUser): AuthenticatedUser {
    return user;
  }
}
