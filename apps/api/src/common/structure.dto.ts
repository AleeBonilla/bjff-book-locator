import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

import type { CapacityUnit } from '../database/schema.types.js';

export class PageQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit = 50;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset = 0;
}

export class CapacityDto {
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  value!: number;

  @IsEnum(['BOOKS', 'CENTIMETERS', 'WEIGHT'])
  unit!: CapacityUnit;
}

export class DistributionValuesDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => CapacityDto)
  capacity?: CapacityDto | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0.0001)
  @Max(1)
  targetFillRatio?: number | null;

  @IsOptional()
  @IsBoolean()
  allowOverflow?: boolean | null;
}

export class PositionDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  position!: number;
}

export class NameDto {
  @MinLength(1)
  @MaxLength(60)
  name!: string;
}
