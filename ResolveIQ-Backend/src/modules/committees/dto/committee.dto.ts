import { IsArray, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { ComplaintCategory } from '../../complaints/entities/complaint.entity';

export class CreateCommitteeDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsArray()
  @IsEnum(ComplaintCategory, { each: true })
  categories: ComplaintCategory[];

  @IsOptional()
  @IsUUID()
  managerId?: string;
}

export class UpdateCommitteeDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  @IsEnum(ComplaintCategory, { each: true })
  categories?: ComplaintCategory[];

  @IsOptional()
  @IsUUID()
  managerId?: string;
}
