import { Module } from '@nestjs/common';
import { AwsModule } from './modules/aws/aws.module';

@Module({
  imports: [AwsModule],
  controllers: [],
  providers: [],
  exports: [],
})
export class LibsModule {}
