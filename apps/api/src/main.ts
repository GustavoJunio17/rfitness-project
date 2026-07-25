import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";
import { RequestMethod, ValidationPipe } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { AppModule } from "./app.module";
import { HttpExceptionFilter } from "./shared/filters/http-exception.filter";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  app.use(helmet());
  app.use(cookieParser());
  app.enableCors({
    origin: config.get<string>("corsOrigin"),
    credentials: true,
  });
  app.setGlobalPrefix("api", {
    exclude: [{ path: "uploads/(.*)", method: RequestMethod.ALL }],
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());

  const swaggerConfig = new DocumentBuilder()
    .setTitle("RFitness API")
    .setDescription("API do sistema de gestão RFitness — estoque, vendas, financeiro, alunos e IA no WhatsApp")
    .setVersion("0.1.0")
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup("api/docs", app, document);

  const port = config.get<number>("port") ?? 3001;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`RFitness API rodando em http://localhost:${port}/api`);
  // eslint-disable-next-line no-console
  console.log(`Swagger disponível em http://localhost:${port}/api/docs`);
}

bootstrap();
