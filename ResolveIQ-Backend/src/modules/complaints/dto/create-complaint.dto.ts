import { IsEnum, IsString, MinLength } from 'class-validator';
import { ComplaintCategory, ComplaintPriority } from '../entities/complaint.entity';

export class CreateComplaintDto {
  @IsString()
  @MinLength(5)
  title: string;

  @IsString()
  @MinLength(10)
  description: string;

  @IsEnum(ComplaintCategory)
  category: ComplaintCategory;

  @IsEnum(ComplaintPriority)
  priority: ComplaintPriority;
}
