import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SignatureController } from './controllers/signature.controller';
import { SignatureService } from './services/signature.service';
import { Signatures } from './entities/signature.entity';
import { UserModule } from '@user/user.module';
import { SignatureMapper } from './dto/signature.mapper';
import { S3Module } from '@app/modules/libs/modules/aws/s3/s3.module';

@Module({
  imports: [TypeOrmModule.forFeature([Signatures]), UserModule, S3Module],
  controllers: [SignatureController],
  providers: [SignatureService, SignatureMapper],
  exports: [SignatureService],
})
export class SignatureModule {}
