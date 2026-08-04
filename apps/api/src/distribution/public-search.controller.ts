import {
  Body,
  Controller,
  Header,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Redirect,
} from '@nestjs/common';
import type { PublicSearchResult } from '@bjff/api-types';

import { Public } from '../auth/session.guard.js';
import { APP_CONFIG, type AppConfig } from '../config.js';
import { SearchClassificationDto } from './distribution.dto.js';
import { PublicSearchService } from './public-search.service.js';

@Controller('api/public')
export class PublicSearchController {
  constructor(
    private readonly searchService: PublicSearchService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  @Public()
  @Post('search')
  @HttpCode(200)
  search(@Body() command: SearchClassificationDto): Promise<PublicSearchResult> {
    return this.searchService.search(command.classificationCode);
  }

  @Public()
  @Post('search/open')
  @Header('Cache-Control', 'no-store')
  @Header('Referrer-Policy', 'no-referrer')
  @Redirect(undefined, HttpStatus.SEE_OTHER)
  openSearch(@Body() command: SearchClassificationDto): {
    url: string;
    statusCode: HttpStatus;
  } {
    const target = new URL('/buscar', this.config.webOrigin);
    target.searchParams.set('codigo', command.classificationCode);

    return { url: target.toString(), statusCode: HttpStatus.SEE_OTHER };
  }
}
