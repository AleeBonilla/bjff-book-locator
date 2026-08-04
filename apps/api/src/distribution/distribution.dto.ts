import { Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

import type {
  CapacityUnit,
  DistributionStatus,
  DistributionStrategy,
} from '@bjff/api-types';

const STRATEGIES: DistributionStrategy[] = [
  'CAPACITY',
  'WEIGHTED',
  'ANCHORED',
  'HYBRID',
  'MANUAL',
];
const STATUSES: DistributionStatus[] = ['PENDING', 'DONE', 'ERROR'];
const CAPACITY_UNITS: CapacityUnit[] = ['BOOKS', 'CENTIMETERS', 'WEIGHT'];

export class CapacityDto {
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  value!: number;

  @IsEnum(CAPACITY_UNITS)
  unit!: CapacityUnit;
}

export class RunDefaultsDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => CapacityDto)
  capacity!: CapacityDto | null;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0.0001)
  @Max(1)
  targetFillRatio!: number;

  @IsBoolean()
  allowOverflow!: boolean;
}

export class AnchorInputDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  locationId!: number;

  @IsString()
  @MaxLength(60)
  boundaryCode!: string;
}

export class ManualRangeInputDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  locationId!: number;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  startCode!: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  endCode!: string | null;
}

export class CreateDistributionRunDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  schemeId!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  collectionLoadId!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  basedOnDistributionRunId?: number | null;

  @IsOptional()
  @IsEnum(STRATEGIES)
  strategy: DistributionStrategy = 'HYBRID';

  @ValidateNested()
  @Type(() => RunDefaultsDto)
  defaults!: RunDefaultsDto;

  @IsOptional()
  @IsArray()
  @ArrayUnique((item: AnchorInputDto) => item.locationId)
  @ValidateNested({ each: true })
  @Type(() => AnchorInputDto)
  anchors: AnchorInputDto[] = [];

  @IsOptional()
  @IsArray()
  @ArrayUnique((item: ManualRangeInputDto) => item.locationId)
  @ValidateNested({ each: true })
  @Type(() => ManualRangeInputDto)
  manualRanges: ManualRangeInputDto[] = [];
}

export class RecalculateDistributionRunDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedRevision!: number;

  @IsBoolean()
  rebuildSnapshot!: boolean;

  @ValidateNested()
  @Type(() => RunDefaultsDto)
  defaults!: RunDefaultsDto;

  @IsOptional()
  @IsArray()
  @ArrayUnique((item: AnchorInputDto) => item.locationId)
  @ValidateNested({ each: true })
  @Type(() => AnchorInputDto)
  anchors: AnchorInputDto[] = [];

  @IsOptional()
  @IsArray()
  @ArrayUnique((item: ManualRangeInputDto) => item.locationId)
  @ValidateNested({ each: true })
  @Type(() => ManualRangeInputDto)
  manualRanges: ManualRangeInputDto[] = [];
}

export class PublishDistributionRunDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedRevision!: number;

  @IsBoolean()
  previewAccepted!: boolean;

  @IsOptional()
  @IsBoolean()
  unassignedAccepted?: boolean;
}

export class ReviewDistributionRangeDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedRevision!: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes!: string | null;
}

export class SearchClassificationDto {
  @IsString()
  @MaxLength(60)
  classificationCode!: string;
}

export class DistributionRunsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  schemeId?: number;

  @IsOptional()
  @IsEnum(STATUSES)
  status?: DistributionStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 50;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset = 0;
}

export class ComparisonQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  againstRunId?: number;
}
