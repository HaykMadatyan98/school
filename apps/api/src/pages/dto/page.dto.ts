import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsMongoId,
  IsObject,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PostStatus } from '@prisma/client';
import { LocalizedTextDto } from '../../common/dto/localized-text.dto';

/** Allow empty am so excerpt can be cleared in admin. */
export class OptionalLocalizedTextDto {
  @ApiPropertyOptional({ example: 'Կարճ նկարագրություն' })
  @IsOptional()
  @IsString()
  @MinLength(0)
  am?: string;
}

export class CreatePageDto {
  @ApiProperty({ type: LocalizedTextDto })
  @IsObject()
  @ValidateNested()
  @Type(() => LocalizedTextDto)
  title!: LocalizedTextDto;

  @ApiPropertyOptional({ example: 'about' })
  @IsOptional()
  @IsString()
  slug?: string;

  @ApiPropertyOptional({ type: LocalizedTextDto })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => LocalizedTextDto)
  excerpt?: LocalizedTextDto;

  @ApiProperty({ type: LocalizedTextDto })
  @IsObject()
  @ValidateNested()
  @Type(() => LocalizedTextDto)
  content!: LocalizedTextDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  coverImage?: string;

  @ApiPropertyOptional({ enum: PostStatus, default: PostStatus.DRAFT })
  @IsOptional()
  @IsEnum(PostStatus)
  status?: PostStatus;

  @ApiPropertyOptional({
    description: 'Parent section slug when this page is a year archive',
    example: 'assessment',
  })
  @IsOptional()
  @IsString()
  parentSlug?: string;

  @ApiPropertyOptional({ example: '2024-2025' })
  @IsOptional()
  @IsString()
  yearLabel?: string;
}

export class UpdatePageDto {
  @ApiPropertyOptional({ type: LocalizedTextDto })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => LocalizedTextDto)
  title?: LocalizedTextDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  slug?: string;

  @ApiPropertyOptional({ type: OptionalLocalizedTextDto })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsObject()
  @ValidateNested()
  @Type(() => OptionalLocalizedTextDto)
  excerpt?: OptionalLocalizedTextDto | null;

  @ApiPropertyOptional({ type: LocalizedTextDto })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => LocalizedTextDto)
  content?: LocalizedTextDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  coverImage?: string | null;

  @ApiPropertyOptional({ enum: PostStatus })
  @IsOptional()
  @IsEnum(PostStatus)
  status?: PostStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  parentSlug?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  yearLabel?: string | null;
}

export class AddYearPageDto {
  @ApiProperty({ example: '2025-2026' })
  @IsString()
  yearLabel!: string;

  @ApiPropertyOptional({ enum: PostStatus, default: PostStatus.DRAFT })
  @IsOptional()
  @IsEnum(PostStatus)
  status?: PostStatus;
}

export class CreateMenuItemDto {
  @ApiProperty({ type: LocalizedTextDto })
  @IsObject()
  @ValidateNested()
  @Type(() => LocalizedTextDto)
  label!: LocalizedTextDto;

  @ApiPropertyOptional({ example: '/p/about' })
  @IsOptional()
  @IsString()
  href?: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  visible?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  openInNewTab?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== '')
  @IsMongoId()
  parentId?: string | null;
}

export class UpdateMenuItemDto {
  @ApiPropertyOptional({ type: LocalizedTextDto })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => LocalizedTextDto)
  label?: LocalizedTextDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  href?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  visible?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  openInNewTab?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== '')
  @IsMongoId()
  parentId?: string | null;
}

export class ReorderMenuDto {
  @ApiProperty({
    type: [String],
    description: 'Ordered list of menu item ids (top-level or siblings)',
  })
  @IsString({ each: true })
  ids!: string[];
}
