import { describe, expect, it } from 'vitest';

import { MockAdminGateway } from './MockAdminGateway';
import { sanitizeSvgForPreview } from './svg';

const threeLevels = [
  { key: 'floor', parentKey: null, name: 'Piso', sortOrder: 1, isSearchTerminal: false },
  { key: 'furniture', parentKey: 'floor', name: 'Mueble', sortOrder: 2, isSearchTerminal: false },
  { key: 'shelf', parentKey: 'furniture', name: 'Anaquel', sortOrder: 3, isSearchTerminal: true },
];

async function createStructuredScheme(gateway: MockAdminGateway) {
  const scheme = (await gateway.createScheme({ name: 'Prueba estructural' })).data;
  await gateway.replaceLevels(scheme.id, threeLevels);
  const confirmed = (await gateway.confirmLevels(scheme.id)).data;
  const floor = (await gateway.addLocations(scheme.id, {
    parentLocationId: null,
    quantity: 1,
    schemeLevelId: confirmed.levels[0]!.id,
  })).data[0]!;
  const furniture = (await gateway.addLocations(scheme.id, {
    parentLocationId: floor.id,
    quantity: 2,
    schemeLevelId: confirmed.levels[1]!.id,
  })).data;
  const firstShelves = (await gateway.addLocations(scheme.id, {
    parentLocationId: furniture[0]!.id,
    quantity: 1,
    schemeLevelId: confirmed.levels[2]!.id,
  })).data;
  return { schemeId: scheme.id, floor, furniture, firstShelves };
}

describe('MockAdminGateway', () => {
  it('mantiene oculta la raíz y exige que todas las ramas estén completas', async () => {
    const gateway = new MockAdminGateway();
    const { schemeId, furniture } = await createStructuredScheme(gateway);

    await expect(gateway.confirmLocations(schemeId)).rejects.toMatchObject({
      code: 'INCOMPLETE_LOCATION_TREE',
      details: ['Mueble 2'],
    });

    await gateway.addLocations(schemeId, { parentLocationId: furniture[1]!.id, quantity: 3 });
    const confirmed = (await gateway.confirmLocations(schemeId)).data;

    expect(confirmed.status).toBe('LOCATIONS_DEFINED');
    expect(confirmed.locations.filter((location) => location.parentLocationId === null)).toHaveLength(1);
    expect(confirmed.locations.some((location) => location.name.toLowerCase().includes('raíz'))).toBe(false);
    expect(confirmed.locations.map((location) => location.code)).toContain(`${schemeId}-1-2-3`);
  });

  it('actualiza estados de rangos y devuelve coincidencias solapadas', async () => {
    const gateway = new MockAdminGateway();
    const { schemeId, furniture, firstShelves } = await createStructuredScheme(gateway);
    const otherShelves = (await gateway.addLocations(schemeId, {
      parentLocationId: furniture[1]!.id,
      quantity: 1,
    })).data;
    await gateway.confirmLocations(schemeId);

    await gateway.saveRange(schemeId, {
      locationId: firstShelves[0]!.id,
      rangeStart: '500 A',
      rangeEnd: '520 Z',
    });
    expect((await gateway.getScheme(schemeId)).data.status).toBe('PARTIALLY_ASSIGNED');

    await gateway.saveRange(schemeId, {
      locationId: otherShelves[0]!.id,
      rangeStart: '510 A',
      rangeEnd: '530 Z',
    });
    expect((await gateway.getScheme(schemeId)).data.status).toBe('ASSIGNED');

    const result = (await gateway.searchTests(schemeId, '515 A')).data;
    expect(result.matches).toHaveLength(2);
    expect(result.maps.topViews).toHaveLength(0);

    await gateway.deleteRange(schemeId, firstShelves[0]!.id);
    expect((await gateway.getScheme(schemeId)).data.status).toBe('PARTIALLY_ASSIGNED');
  });

  it('calcula cobertura de mapas y permite publicar solo al completar el esquema', async () => {
    const gateway = new MockAdminGateway();
    const { schemeId, furniture, firstShelves } = await createStructuredScheme(gateway);
    const otherShelves = (await gateway.addLocations(schemeId, { parentLocationId: furniture[1]!.id, quantity: 1 })).data;
    await gateway.confirmLocations(schemeId);
    await gateway.saveRanges(schemeId, [
      { locationId: firstShelves[0]!.id, rangeStart: '500 A', rangeEnd: '509 Z' },
      { locationId: otherShelves[0]!.id, rangeStart: '510 A', rangeEnd: '519 Z' },
    ]);

    const withoutMap = (await gateway.reviewScheme(schemeId)).data;
    expect(withoutMap.publishable).toBe(false);

    const representedLevelId = (await gateway.getScheme(schemeId)).data.levels[1]!.id;
    const groups = furniture.map((location, index) => `<g data-location-code="${location.code}"><rect x="${index * 60}" y="0" width="50" height="50"/></g>`).join('');
    await gateway.saveTopMap(schemeId, {
      name: 'Plano',
      svgName: 'plano.svg',
      representedLevelIds: [representedLevelId],
      source: `<svg xmlns="http://www.w3.org/2000/svg">${groups}</svg>`,
    });

    expect((await gateway.reviewScheme(schemeId)).data.publishable).toBe(true);
    const published = (await gateway.publishScheme(schemeId, true)).data;
    expect(published.publishedAt).not.toBeNull();
    expect(published.isActive).toBe(true);
    await expect(gateway.updateScheme(schemeId, { name: 'Cambio' })).rejects.toMatchObject({
      code: 'PUBLISHED_SCHEME_IMMUTABLE',
    });
  });

  it('clona cada alcance y reescribe los códigos de mapas superiores', async () => {
    const gateway = new MockAdminGateway();

    const levels = (await gateway.cloneScheme('18', { name: 'Solo niveles', scope: 'levels' })).data;
    expect(levels.status).toBe('DRAFT');
    expect(levels.locations).toHaveLength(0);

    const locations = (await gateway.cloneScheme('18', { name: 'Con ubicaciones', scope: 'levels_and_locations' })).data;
    expect(locations.status).toBe('LEVELS_DEFINED');
    expect(locations.ranges).toHaveLength(0);
    expect(locations.locations.every((location) => location.code.startsWith(`${locations.id}-`))).toBe(true);

    const all = (await gateway.cloneScheme('18', { name: 'Copia completa', scope: 'all' })).data;
    expect(all.status).toBe('ASSIGNED');
    expect(all.publishedAt).toBeNull();
    expect(all.isActive).toBe(false);
    expect(all.topMaps[0]?.source).toContain(`data-location-code="${all.id}-`);
    expect(all.topMaps[0]?.source).not.toContain('data-location-code="18-');
  });
});

describe('sanitizeSvgForPreview', () => {
  it('elimina contenido activo y referencias externas', () => {
    const safe = sanitizeSvgForPreview(`
      <svg xmlns="http://www.w3.org/2000/svg">
        <script>alert(1)</script>
        <foreignObject><div>HTML</div></foreignObject>
        <a href="https://example.com"><rect onclick="alert(1)" width="10" height="10" /></a>
        <g data-location-code="29-1"><rect width="20" height="20" /></g>
      </svg>
    `);

    expect(safe).not.toMatch(/script|foreignObject|onclick|https:\/\//);
    expect(safe).toContain('data-location-code="29-1"');
  });
});
