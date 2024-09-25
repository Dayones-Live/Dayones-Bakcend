import { Module } from '@nestjs/common';
import { JwtGuard } from './guards/aws.cognito.guard';

@Module({
  imports: [],
  providers: [JwtGuard],
  exports: [JwtGuard],
})
export class AuthModule {}
