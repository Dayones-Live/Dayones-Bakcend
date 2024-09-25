import { Module } from '@nestjs/common';
import { ServerHealthController } from './controller/server-health-check.controller';
import { ServerHealthCheckService } from './services/server-health-check.services';

@Module({
  imports: [],
  controllers: [ServerHealthController],
  providers: [ServerHealthCheckService],
  exports: [ServerHealthCheckService],
})
export class ServerHealthCheckModule {}
