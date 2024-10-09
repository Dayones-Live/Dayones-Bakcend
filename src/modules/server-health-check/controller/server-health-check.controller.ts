import { Controller, Get } from '@nestjs/common';
import { ServerHealthCheckService } from '../services/server-health-check.services';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '@app/modules/auth/decorators/public.decorator';

@ApiTags('health')
@Controller('health')
@Public()
export class ServerHealthController {
  constructor(private serverHealthCheckService: ServerHealthCheckService) {}

  /**
   * Endpoint to get the current server status.
   *
   * This method returns a string representing the current health status of the server.
   * It calls the `getServerStatus()` method from the `ServerHealthCheckService`.
   *
   * @returns {string} - The current server status
   *
   * @example
   * GET /health
   * Response: "Server is healthy"
   */
  @Get()
  getServerStatus(): string {
    return this.serverHealthCheckService.getServerStatus();
  }
}
