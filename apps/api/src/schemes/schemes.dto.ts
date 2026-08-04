import { Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

import { DistributionValuesDto } from '../common/structure.dto.js';

export class CreateSchemeDto {
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string | null;
}

export class UpdateSchemeDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string | null;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

export class CopySchemeDto extends CreateSchemeDto {}

export class CreateLocationDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  parentLocationId?: number | null;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  structureTemplateId!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  structureTemplateNodeId!: number;

  @IsString()
  @MinLength(1)
  @MaxLength(60)
  name!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  position?: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  mapElementId?: string | null;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

export class UpdateLocationDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  mapElementId?: string | null;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

export class MoveLocationDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  parentLocationId?: number | null;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  position!: number;
}

export class OrderLocationsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  parentLocationId?: number | null;

  @IsArray()
  @ArrayUnique()
  @IsInt({ each: true })
  orderedLocationIds!: number[];
}

export class ReplaceLocationSettingsDto extends DistributionValuesDto {}
