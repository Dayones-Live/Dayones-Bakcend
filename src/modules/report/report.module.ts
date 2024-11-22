import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Report } from './entities/report.entity';
import { ReportController } from './controllers/report.controller';
import { UserModule } from '../user/user.module';
import { ReportService } from './services/report.service';
import { ReportMapper } from './dto/report.mapper';
@Module({
  imports: [TypeOrmModule.forFeature([Report]), UserModule],
  controllers: [ReportController],
  providers: [ReportService, ReportMapper],
  exports: [ReportService],
})
export class ReportModule {}
