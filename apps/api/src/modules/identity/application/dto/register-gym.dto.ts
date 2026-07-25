import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsString, Matches, MinLength } from "class-validator";

export class RegisterGymDto {
  @ApiProperty({ example: "Academia Vitória" })
  @IsString()
  @MinLength(2)
  gymName!: string;

  @ApiProperty({ example: "academia-vitoria", description: "Identificador único da academia (slug)" })
  @IsString()
  @Matches(/^[a-z0-9-]+$/, {
    message: "O identificador deve conter apenas letras minúsculas, números e hífens.",
  })
  gymSlug!: string;

  @ApiProperty({ example: "Maria Silva" })
  @IsString()
  @MinLength(2)
  adminName!: string;

  @ApiProperty({ example: "maria@academiavitoria.com" })
  @IsEmail()
  adminEmail!: string;

  @ApiProperty({ example: "SenhaForte@123", minLength: 8 })
  @IsString()
  @MinLength(8)
  adminPassword!: string;
}
