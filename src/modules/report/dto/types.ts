import { ApiHideProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional } from 'class-validator';

export class SaveReportInput {
  @IsNotEmpty({ message: 'Description is required' })
  description: string;

  @ApiHideProperty()
  @IsOptional()
  reportedBy?: string;

  @ApiPropertyOptional({
    description: 'ID of the user being reported (omit if reporting a post or comment)',
  })
  @IsOptional()
  reportedUserId?: string;

  @ApiPropertyOptional({
    description: 'ID of the post being reported (omit if reporting a user or comment)',
  })
  @IsOptional()
  reportedPostId?: string;

  @ApiPropertyOptional({
    description: 'ID of the comment being reported (omit if reporting a user or post)',
  })
  @IsOptional()
  reportedCommentId?: string;
}
