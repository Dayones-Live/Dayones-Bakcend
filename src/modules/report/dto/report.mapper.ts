import { mapInputToEntity } from '@app/shared/utils';
import { SaveReportInput } from './types';
import { Report } from '../entities/report.entity';

export class ReportMapper {
  dtoToEntity(saveReportInput: SaveReportInput): Report {
    const updateRecord: boolean = false;
    return mapInputToEntity(new Report(), saveReportInput, updateRecord);
  }
}
