import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ServerHealthCheckService } from '../services/server-health-check.services';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('health')
@Controller('health')
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
  @ApiOperation({ summary: 'Get server health status' })
  @ApiOkResponse({
    description: 'The server is healthy.',
    schema: {
      example: 'Server is healthy', // Example response
    },
  })
  getServerStatus(): string {
    return this.serverHealthCheckService.getServerStatus();
  }
}
