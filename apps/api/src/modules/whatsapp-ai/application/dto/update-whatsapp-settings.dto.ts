import { ApiProperty } from "@nestjs/swagger";
import { IsString, Matches, MinLength } from "class-validator";

export class UpdateWhatsAppSettingsDto {
  @ApiProperty({ example: "rfitness-demo", description: "Nome da instância criada no Evolution API" })
  @IsString()
  @MinLength(1)
  @Matches(/^[a-z0-9-]+$/, {
    message: "O nome da instância deve conter apenas letras minúsculas, números e hífens.",
  })
  whatsappInstanceName!: string;
}
