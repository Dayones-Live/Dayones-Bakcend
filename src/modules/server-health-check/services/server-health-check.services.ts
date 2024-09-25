import { Injectable } from '@nestjs/common';

@Injectable()
export class ServerHealthCheckService {
  getServerStatus(): string {
    return 'Server is running!';
  }
}
