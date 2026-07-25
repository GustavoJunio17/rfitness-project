import { Controller, Get } from "@nestjs/common";
import { ApiExcludeController } from "@nestjs/swagger";
import { Public } from "./shared/decorators/public.decorator";

@ApiExcludeController()
@Controller()
export class AppController {
  @Public()
  @Get("health")
  health() {
    return { status: "ok", service: "rfitness-api", timestamp: new Date().toISOString() };
  }
}
