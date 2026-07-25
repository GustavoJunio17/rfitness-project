import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { createHash, randomBytes } from "crypto";
import type { AuthenticatedUser } from "../../../../shared/types/authenticated-user";

export interface RefreshTokenPair {
  value: string;
  hash: string;
  expiresAt: Date;
}

@Injectable()
export class TokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  signAccessToken(payload: AuthenticatedUser): string {
    return this.jwtService.sign(payload, {
      secret: this.configService.get<string>("jwt.accessSecret"),
      expiresIn: this.configService.get<string>("jwt.accessExpiresIn"),
    });
  }

  generateRefreshToken(): RefreshTokenPair {
    const value = randomBytes(48).toString("hex");
    const expiresIn = this.configService.get<string>("jwt.refreshExpiresIn") ?? "7d";
    return {
      value,
      hash: this.hashRefreshToken(value),
      expiresAt: new Date(Date.now() + this.parseDurationMs(expiresIn)),
    };
  }

  hashRefreshToken(value: string): string {
    return createHash("sha256").update(value).digest("hex");
  }

  private parseDurationMs(duration: string): number {
    const match = /^(\d+)([smhd])$/.exec(duration.trim());
    if (!match) return 7 * 24 * 60 * 60 * 1000;
    const amount = Number(match[1]);
    const unitMs = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[match[2]] ?? 86_400_000;
    return amount * unitMs;
  }
}
