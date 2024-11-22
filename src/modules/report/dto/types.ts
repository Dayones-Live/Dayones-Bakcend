import { IsOptional } from 'class-validator';

export class SaveReportInput {
  @IsOptional()
  description: string;

  @IsOptional()
  reportedBy: string;

  @IsOptional()
  reportedUserId: string;

  @IsOptional()
  reportedPostId: string;

  @IsOptional()
  reportedCommentId: string;
}
