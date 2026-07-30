import { Inject, Injectable } from '@nestjs/common';

import { ApiError } from '../common/api-error.js';
import { APP_CONFIG, type AppConfig } from '../config.js';
import { buildColumnMapping, type ColumnMapping } from './column-mapping.js';
import { CsvReaderService, type CsvReadResult } from './csv-reader.service.js';

/**
 * Validación del contrato del archivo, **antes** de crear la carga.
 *
 * Un archivo incompatible responde `4xx` y no deja rastro en el historial: `ERROR`
 * queda reservado para los fallos durante el procesamiento. Decisión registrada en
 * plan.md, sección «Decisiones de diseño tomadas en esta fase».
 */

export interface ValidatedFile {
  read: CsvReadResult;
  mapping: ColumnMapping;
}

@Injectable()
export class FileValidationService {
  constructor(
    private readonly csv: CsvReaderService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  /**
   * @throws {ApiError} `FILE_TOO_LARGE`, `TOO_MANY_ROWS`, `INVALID_ENCODING`,
   * `EMPTY_FILE`, `MISSING_HEADER` o `MISSING_REQUIRED_COLUMN` (FR-013, FR-013a).
   */
  validate(buffer: Buffer): ValidatedFile {
    // FR-013a: el límite de tamaño se comprueba antes de decodificar nada.
    if (buffer.byteLength > this.config.importMaxFileBytes) {
      throw ApiError.fileTooLarge(this.config.importMaxFileBytes, buffer.byteLength);
    }

    if (buffer.byteLength === 0) throw ApiError.emptyFile();

    const text = this.csv.decode(buffer);
    const read = this.csv.read(text);

    if (read.rows.length > this.config.importMaxRows) {
      throw ApiError.tooManyRows(this.config.importMaxRows);
    }

    const mapping = buildColumnMapping(read.header);

    return { read, mapping };
  }
}
