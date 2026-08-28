import { afterEach, describe, expect, it, vi } from 'vitest';

import { HttpAdminGateway } from './HttpAdminGateway';

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const scheme = {
  schemeId: 41,
  name: 'Colección real',
  status: 'PARTIALLY_ASSIGNED',
  shortDescription: null,
  isActive: false,
  publishedAt: null,
  updatedAt: '2026-08-28T03:00:00.000Z',
};

describe('HttpAdminGateway', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('compone el detalle y convierte identificadores, rangos y mapas', async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.endsWith('/maps')) {
        return json({ data: [
          {
            mapLayerId: 80,
            name: 'Plano',
            viewType: 'TOP',
            renderMode: 'STATIC',
            enabled: true,
            representedLevels: [{ schemeLevelId: 11, drilldownMapLayerId: 81 }],
            svgs: [{ mapLayerSvgId: 90, name: 'Piso', variantCode: null, assetUrl: '/api/assets/maps/41/top.svg', slotCount: null, enabled: true }],
            assignments: [],
          },
          {
            mapLayerId: 81,
            name: 'Anaqueles',
            viewType: 'FRONT',
            renderMode: 'TEMPLATE',
            enabled: true,
            representedLevels: [{ schemeLevelId: 12, drilldownMapLayerId: null }],
            svgs: [{ mapLayerSvgId: 91, name: 'Dos espacios', variantCode: 'two', assetUrl: '/api/assets/maps/41/front.svg', slotCount: 2, enabled: true }],
            assignments: [{ mapLayerSvgId: 91, contextLocationId: 101 }],
          },
        ] });
      }
      return json({ data: {
        ...scheme,
        levels: [
          { schemeLevelId: 11, parentLevelId: null, name: 'Mueble', sortOrder: 1, isSearchTerminal: false },
          { schemeLevelId: 12, parentLevelId: 11, name: 'Anaquel', sortOrder: 2, isSearchTerminal: true },
        ],
        locations: [
          { locationId: 101, parentLocationId: null, schemeLevelId: 11, name: 'Mueble 1', code: '41-1', sortOrder: 1, range: null },
          { locationId: 102, parentLocationId: 101, schemeLevelId: 12, name: 'Anaquel 1', code: '41-1-1', sortOrder: 1, range: { start: '500 A', end: '509 Z' } },
        ],
      } });
    });
    vi.stubGlobal('fetch', fetchMock);

    const detail = (await new HttpAdminGateway().getScheme('41')).data;

    expect(detail.id).toBe('41');
    expect(detail.shortDescription).toBe('');
    expect(detail.levels[1]).toMatchObject({ id: '12', parentKey: '11' });
    expect(detail.locations[1]).toMatchObject({ id: '102', parentLocationId: '101', path: [1, 1] });
    expect(detail.ranges).toEqual([{ locationId: '102', rangeStart: '500 A', rangeEnd: '509 Z' }]);
    expect(detail.topMaps[0]).toMatchObject({ id: '80', svgId: '90', drilldowns: { 11: '81' } });
    expect(detail.frontLayers[0]).toMatchObject({ representedLevelId: '12', assignments: { 101: '91' } });
  });

  it('envía SVG multipart, conserva el nombre y trata el CSV como texto', async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/locations.csv')) return new Response('location_code,name\r\n41-1,Mueble 1');
      const form = init?.body as FormData;
      expect(init?.method).toBe('POST');
      expect(init?.headers).toBeUndefined();
      expect(JSON.parse(String(form.get('metadata')))).toEqual({
        name: 'Plano',
        svgName: 'plano.svg',
        representedLevelIds: [11],
      });
      expect((form.get('svg') as File).name).toBe('plano.svg');
      return json({ data: { mapLayerId: 80, mapLayerSvgId: 90, assetUrl: '/api/assets/maps/41/top.svg', removedItems: 2 } }, 201);
    });
    vi.stubGlobal('fetch', fetchMock);
    const gateway = new HttpAdminGateway();

    const upload = await gateway.saveTopMap('41', {
      name: 'Plano',
      svgName: 'plano.svg',
      representedLevelIds: ['11'],
      file: new File(['<svg/>'], 'plano.svg', { type: 'image/svg+xml' }),
    });
    const csv = await gateway.exportLocationsCsv('41');

    expect(upload.data).toEqual({ mapLayerId: '80', mapLayerSvgId: '90', assetUrl: '/api/assets/maps/41/top.svg', removedItems: 2 });
    expect(csv.data).toContain('41-1,Mueble 1');
  });

  it('envía confirmación al eliminar y conserva el error funcional de la API', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(json({ data: { schemeId: 41, deleted: true, wasActive: true, wasPublished: true } }))
      .mockResolvedValueOnce(json({ error: { code: 'INVALID_SVG', message: 'El SVG no es válido.', details: [{ field: 'svg' }] } }, 422));
    vi.stubGlobal('fetch', fetchMock);
    const gateway = new HttpAdminGateway();

    const deleted = await gateway.deleteScheme('41');
    expect(deleted.data).toMatchObject({ schemeId: '41', wasActive: true });
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({ confirmDataLoss: true });
    await expect(gateway.validateMaps('41')).rejects.toMatchObject({
      status: 422,
      code: 'INVALID_SVG',
      message: 'El SVG no es válido.',
      details: [{ field: 'svg' }],
    });
  });

  it('explica cuando no puede conectarse con la API', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));

    await expect(new HttpAdminGateway().listSchemes()).rejects.toMatchObject({
      status: 0,
      code: 'API_UNAVAILABLE',
    });
  });
});
