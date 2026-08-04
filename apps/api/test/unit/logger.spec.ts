import { afterEach, describe, expect, it, vi } from 'vitest';

import { logger } from '../../src/common/logger.js';

describe('logger estructurado', () => {
  afterEach(() => vi.restoreAllMocks());

  it('omite códigos, claves, fronteras y material bibliográfico', () => {
    const write = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    logger.info('distribution_calculation_finished', {
      runId: 7,
      bookCount: 12,
      classificationCode: '658.4 A123',
      comparableKey: 'privada',
      boundaryCode: '600',
      range_start_code: '500',
      title: 'Título privado',
      sourceBarcode: 'ABC123',
    });

    const line = String(write.mock.calls[0]?.[0]);
    expect(line).toContain('"runId":7');
    expect(line).toContain('"bookCount":12');
    expect(line).not.toContain('658.4 A123');
    expect(line).not.toContain('privada');
    expect(line).not.toContain('Título privado');
    expect(line).not.toContain('ABC123');
    expect(line.match(/\[omitido\]/g)?.length).toBe(6);
  });

  it('registra cálculo y publicación solo con identificadores, conteos y desenlace', () => {
    const write = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    logger.info('distribution_calculation_finished', {
      runId: 3,
      result: 'DONE',
      durationMs: 25,
      bookCount: 100,
      positionCount: 4,
      unassignedCount: 2,
    });
    logger.info('distribution_publication_finished', {
      runId: 3,
      result: 'DONE',
      durationMs: 8,
    });

    const output = write.mock.calls.map((call) => String(call[0])).join('');
    expect(output).toContain('distribution_calculation_finished');
    expect(output).toContain('distribution_publication_finished');
    expect(output).not.toMatch(/classification|boundary|barcode|cookie|title/i);
  });
});
