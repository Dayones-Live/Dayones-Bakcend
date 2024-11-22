import { IsNotEmpty, IsOptional, Max, Min } from 'class-validator';

export class SaveFeedbackInput {
  @IsOptional()
  id: string;

  @IsNotEmpty({ message: 'Description is required!' })
  description: string;

  @IsOptional()
  @Min(0)
  @Max(5)
  rating: number;

  @IsOptional()
  feedbackBy: string;
}
