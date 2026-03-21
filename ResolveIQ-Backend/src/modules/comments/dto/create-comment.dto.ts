import { IsString, MaxLength, MinLength, IsOptional, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateCommentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  body: string;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === true || value === 'true')
  isInternal?: boolean;
}
