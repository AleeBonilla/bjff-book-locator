import { Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

import { DistributionValuesDto } from '../common/structure.dto.js';
import type { LocationRole } from '../database/schema.types.js';

export class CreateStructureTemplateDto {
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string | null;
}

export class UpdateStructureTemplateDto {
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

export class CreateTemplateNodeDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  parentTemplateNodeId?: number | null;

  @IsString()
  @MinLength(1)
  @MaxLength(40)
  name!: string;

  @IsIn(['CONTAINER', 'POSITION'])
  role!: LocationRole;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  position?: number;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  visualKind?: string | null;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => DistributionValuesDto)
  defaults?: DistributionValuesDto | null;
}

export class UpdateTemplateNodeDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  name?: string;

  @IsOptional()
  @IsIn(['CONTAINER', 'POSITION'])
  role?: LocationRole;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  visualKind?: string | null;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => DistributionValuesDto)
  defaults?: DistributionValuesDto | null;
}

export class MoveTemplateNodeDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  parentTemplateNodeId?: number | null;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  position!: number;
}

export class OrderTemplateNodesDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  parentTemplateNodeId?: number | null;

  @IsArray()
  @ArrayUnique()
  @IsInt({ each: true })
  orderedNodeIds!: number[];
}
