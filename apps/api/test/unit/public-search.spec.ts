import { describe, expect, it, vi } from 'vitest';

import { PublicSearchService } from '../../src/distribution/public-search.service.js';

describe('resolución de búsqueda pública', () => {
  it('normaliza, prioriza coincidencias exactas y deduplica rutas', async () => {
    const repository = {
      publicExact: vi.fn().mockResolvedValue({
        distributionAvailable: true,
        exactExists: true,
        locations: [
          { path: 'Sección A / Anaquel 1', mapElementId: null, sequence: 1 },
          { path: 'Sección A / Anaquel 1', mapElementId: null, sequence: 1 },
          { path: 'Sección A / Anaquel 2', mapElementId: 'm2', sequence: 2 },
        ],
      }),
      publicRange: vi.fn(),
    };
    const service = new PublicSearchService(repository as never);
    const result = await service.search('658,4 A123');
    expect(repository.publicExact).toHaveBeenCalledWith(expect.any(String));
    expect(repository.publicRange).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      status: 'FOUND',
      matchType: 'EXACT',
      approximate: true,
    });
    expect(result.locations).toHaveLength(2);
  });

  it('no cae al rango cuando existen registros exactos sin placements', async () => {
    const repository = {
      publicExact: vi.fn().mockResolvedValue({
        distributionAvailable: true,
        exactExists: true,
        locations: [],
      }),
      publicRange: vi.fn(),
    };
    const result = await new PublicSearchService(repository as never).search('100');
    expect(result.status).toBe('NOT_FOUND');
    expect(repository.publicRange).not.toHaveBeenCalled();
  });

  it('usa el rango solo sin coincidencia exacta y responde seguro para entrada vacía', async () => {
    const repository = {
      publicExact: vi.fn().mockResolvedValue({
        distributionAvailable: true,
        exactExists: false,
        locations: [],
      }),
      publicRange: vi
        .fn()
        .mockResolvedValue([
          { path: 'Sección B / Anaquel 4', mapElementId: null, sequence: 4 },
        ]),
    };
    const service = new PublicSearchService(repository as never);
    expect(await service.search('150')).toMatchObject({
      status: 'FOUND',
      matchType: 'RANGE',
    });
    expect(await service.search('')).toMatchObject({
      status: 'NOT_FOUND',
      locations: [],
    });
  });

  it('no convierte entradas inválidas o ambiguas en coincidencias de rango', async () => {
    const repository = {
      publicExact: vi.fn(),
      publicRange: vi.fn(),
    };
    const service = new PublicSearchService(repository as never);

    const invalidCodes = [
      '',
      ' . - , ',
      '@@@',
      'ABC',
      '100<script>',
      '100 OR 1=1',
      '100 A123 DROP',
      '１２３',
      '\u0000',
    ];

    for (const code of invalidCodes) {
      await expect(service.search(code)).resolves.toMatchObject({
        status: 'NOT_FOUND',
        locations: [],
      });
    }
    expect(repository.publicExact).not.toHaveBeenCalled();
    expect(repository.publicRange).not.toHaveBeenCalled();
  });

  it('tolera entradas arbitrarias acotadas sin lanzar excepciones', async () => {
    const repository = {
      publicExact: vi.fn().mockResolvedValue({
        distributionAvailable: false,
        exactExists: false,
        locations: [],
      }),
      publicRange: vi.fn(),
    };
    const service = new PublicSearchService(repository as never);
    const alphabet = 'ABCxyz019 .,-@<>/=\\\t\nñ💣';
    let state = 0x5eed1234;

    for (let sample = 0; sample < 500; sample += 1) {
      state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
      const length = state % 61;
      let code = '';
      for (let index = 0; index < length; index += 1) {
        state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
        code += alphabet[state % alphabet.length];
      }

      await expect(service.search(code)).resolves.toMatchObject({
        status: 'NOT_FOUND',
        locations: [],
      });
    }
  });
});
