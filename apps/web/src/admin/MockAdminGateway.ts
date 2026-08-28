import type { AdminGateway } from './AdminGateway';
import { highlightSvg, sanitizeSvgForPreview } from './svg';
import {
  AdminGatewayError,
  type AddLocationsInput,
  type ApiSuccess,
  type CloneScope,
  type CreateSchemeInput,
  type FrontMapLayer,
  type Location,
  type LocationRange,
  type MapValidation,
  type ReplaceLevelInput,
  type SaveFrontVariantInput,
  type SaveRangeInput,
  type SaveTopMapInput,
  type Scheme,
  type SchemeLevel,
  type SchemeReview,
  type SearchMatch,
  type SearchTestResult,
  type UpdateSchemeInput,
  locationRoute,
  schemeCanRunSearchTests,
  terminalLocations,
} from './types';

function response<T>(data: T): ApiSuccess<T> {
  return { data: structuredClone(data) };
}

function fail(status: number, code: string, message: string, details: string[] = []): never {
  throw new AdminGatewayError(status, { code, message, details });
}

function now() {
  return new Date().toISOString();
}

function defaultLevels(schemeId: string): SchemeLevel[] {
  const names = ['Piso', 'Fila', 'Cara', 'Mueble', 'Anaquel'];
  return names.map((name, index) => ({
    id: `${schemeId}-level-${index + 1}`,
    key: name.toLowerCase(),
    parentKey: index === 0 ? null : names[index - 1]!.toLowerCase(),
    name,
    sortOrder: index + 1,
    isSearchTerminal: index === names.length - 1,
  }));
}

function buildSeedLocations(schemeId: string, levels: SchemeLevel[]) {
  const locations: Location[] = [];

  function add(levelIndex: number, parentLocationId: string | null, path: number[]) {
    const ordinal = path.at(-1) ?? 1;
    const level = levels[levelIndex]!;
    const id = `${schemeId}-location-${path.join('-')}`;
    locations.push({
      id,
      levelId: level.id,
      parentLocationId,
      name: `${level.name} ${ordinal}`,
      ordinal,
      sortOrder: ordinal,
      code: `${schemeId}-${path.join('-')}`,
      path,
    });
    return id;
  }

  const floor = add(0, null, [1]);
  for (let rowOrdinal = 1; rowOrdinal <= 2; rowOrdinal += 1) {
    const row = add(1, floor, [1, rowOrdinal]);
    const face = add(2, row, [1, rowOrdinal, 1]);
    for (let furnitureOrdinal = 1; furnitureOrdinal <= 2; furnitureOrdinal += 1) {
      const furniture = add(3, face, [1, rowOrdinal, 1, furnitureOrdinal]);
      for (let shelfOrdinal = 1; shelfOrdinal <= 3; shelfOrdinal += 1) {
        add(4, furniture, [1, rowOrdinal, 1, furnitureOrdinal, shelfOrdinal]);
      }
    }
  }

  return locations;
}

function seedTopSvg(scheme: Scheme) {
  const furnitureLevel = scheme.levels[3];
  const furniture = scheme.locations.filter((location) => location.levelId === furnitureLevel?.id);
  const groups = furniture
    .map((location, index) => {
      const x = 65 + (index % 2) * 400;
      const y = 85 + Math.floor(index / 2) * 190;
      return `<g data-location-code="${location.code}"><rect x="${x}" y="${y}" width="310" height="120" fill="#f7f7f4" stroke="#50636a" stroke-width="5"/><text x="${x + 24}" y="${y + 68}" font-family="Arial" font-size="26">${location.name}</text></g>`;
    })
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 860 520"><rect width="860" height="520" fill="#deded9"/>${groups}</svg>`;
}

function seedFrontSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 860 330"><rect width="860" height="330" fill="#deded9"/><g data-slot="1"><rect x="70" y="40" width="720" height="62" fill="#f7f7f4" stroke="#50636a" stroke-width="4"/></g><g data-slot="2"><rect x="70" y="130" width="720" height="62" fill="#f7f7f4" stroke="#50636a" stroke-width="4"/></g><g data-slot="3"><rect x="70" y="220" width="720" height="62" fill="#f7f7f4" stroke="#50636a" stroke-width="4"/></g></svg>`;
}

function completeSeedScheme(id: string, name: string, active: boolean): Scheme {
  const levels = defaultLevels(id);
  const locations = buildSeedLocations(id, levels);
  const terminals = locations.filter((location) => location.levelId === levels.at(-1)?.id);
  const ranges = terminals.map((location, index) => ({
    locationId: location.id,
    rangeStart: index < 3 ? ['500 A', '510 B', '515 A'][index]! : `${600 + index * 10} A`,
    rangeEnd: index < 3 ? ['520 Z', '530 Z', '540 Z'][index]! : `${609 + index * 10}.9 Z`,
  }));
  const base: Scheme = {
    id,
    name,
    shortDescription: 'Configuración completa de la colección general.',
    status: 'ASSIGNED',
    isActive: active,
    publishedAt: active ? '2026-08-20T14:30:00.000Z' : null,
    updatedAt: '2026-08-20T14:30:00.000Z',
    orderingProfileCode: 'ddc-base-v1',
    levels,
    locations,
    ranges,
    topMaps: [],
    frontLayers: [],
  };
  const topSource = seedTopSvg(base);
  base.topMaps = [{
    id: `${id}-top-1`,
    name: 'Plano principal',
    svgName: 'Piso 1',
    source: topSource,
    representedLevelIds: [levels[3]!.id],
    enabled: true,
  }];
  const furniture = locations.filter((location) => location.levelId === levels[3]!.id);
  base.frontLayers = [{
    id: `${id}-front-1`,
    name: 'Muebles estándar',
    representedLevelId: levels[3]!.id,
    enabled: true,
    variants: [{
      id: `${id}-variant-1`,
      name: 'Tres anaqueles',
      variantCode: 'shelves-3',
      slotCount: 3,
      source: seedFrontSvg(),
    }],
    assignments: Object.fromEntries(
      furniture.map((location) => [location.id, `${id}-variant-1`]),
    ),
  }];
  return base;
}

function seedSchemes() {
  const active = completeSeedScheme('18', 'Colección general 2025', true);
  const ready = completeSeedScheme('23', 'Colección general 2026', false);
  const draftLevels = defaultLevels('27');
  const locationDraft: Scheme = {
    id: '27',
    name: 'Sala de referencia',
    shortDescription: 'Estructura de la sala de consulta.',
    status: 'LEVELS_DEFINED',
    isActive: false,
    publishedAt: null,
    updatedAt: '2026-08-24T09:12:00.000Z',
    orderingProfileCode: 'ddc-base-v1',
    levels: draftLevels,
    locations: [],
    ranges: [],
    topMaps: [],
    frontLayers: [],
  };
  const earlyDraft: Scheme = {
    id: '28',
    name: 'Colección de reserva',
    shortDescription: '',
    status: 'DRAFT',
    isActive: false,
    publishedAt: null,
    updatedAt: '2026-08-25T16:40:00.000Z',
    orderingProfileCode: 'ddc-base-v1',
    levels: [],
    locations: [],
    ranges: [],
    topMaps: [],
    frontLayers: [],
  };
  return [active, ready, locationDraft, earlyDraft];
}

export class MockAdminGateway implements AdminGateway {
  private schemes = new Map(seedSchemes().map((scheme) => [scheme.id, scheme]));
  private nextSchemeId = 29;
  private nextEntityId = 1;

  private scheme(schemeId: string) {
    const scheme = this.schemes.get(schemeId);
    if (!scheme) fail(404, 'SCHEME_NOT_FOUND', 'El esquema no existe.');
    return scheme;
  }

  private editable(scheme: Scheme) {
    if (scheme.publishedAt) {
      fail(409, 'PUBLISHED_SCHEME_IMMUTABLE', 'Un esquema publicado no se puede modificar.');
    }
  }

  private touch(scheme: Scheme) {
    scheme.updatedAt = now();
  }

  async listSchemes() {
    return response([...this.schemes.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
  }

  async getScheme(schemeId: string) {
    return response(this.scheme(schemeId));
  }

  async createScheme(input: CreateSchemeInput) {
    const name = input.name.trim();
    if (!name) fail(400, 'INVALID_SCHEME_NAME', 'Escribe un nombre para el esquema.');
    const id = String(this.nextSchemeId++);
    const scheme: Scheme = {
      id,
      name,
      shortDescription: input.shortDescription?.trim() ?? '',
      status: 'DRAFT',
      isActive: false,
      publishedAt: null,
      updatedAt: now(),
      orderingProfileCode: 'ddc-base-v1',
      levels: [],
      locations: [],
      ranges: [],
      topMaps: [],
      frontLayers: [],
    };
    this.schemes.set(id, scheme);
    return response(scheme);
  }

  async updateScheme(schemeId: string, input: UpdateSchemeInput) {
    const scheme = this.scheme(schemeId);
    this.editable(scheme);
    if (input.name !== undefined) {
      if (!input.name.trim()) fail(400, 'INVALID_SCHEME_NAME', 'Escribe un nombre para el esquema.');
      scheme.name = input.name.trim();
    }
    if (input.shortDescription !== undefined) scheme.shortDescription = input.shortDescription.trim();
    this.touch(scheme);
    return response(scheme);
  }

  async deleteScheme(schemeId: string) {
    this.scheme(schemeId);
    this.schemes.delete(schemeId);
    return response(null);
  }

  async cloneScheme(schemeId: string, input: { name: string; scope: CloneScope }) {
    const source = this.scheme(schemeId);
    if (!input.name.trim()) fail(400, 'INVALID_SCHEME_NAME', 'Escribe un nombre para la copia.');
    const id = String(this.nextSchemeId++);
    const clone = structuredClone(source);
    clone.id = id;
    clone.name = input.name.trim();
    clone.isActive = false;
    clone.publishedAt = null;
    clone.updatedAt = now();

    const levelIdMap = new Map<string, string>();
    clone.levels = source.levels.map((level, index) => {
      const newId = `${id}-level-${index + 1}`;
      levelIdMap.set(level.id, newId);
      return { ...level, id: newId };
    });

    if (input.scope === 'levels') {
      clone.status = 'DRAFT';
      clone.locations = [];
      clone.ranges = [];
      clone.topMaps = [];
      clone.frontLayers = [];
    } else {
      const locationIdMap = new Map<string, string>();
      clone.locations = source.locations.map((location) => {
        const newId = `${id}-location-${location.path.join('-')}`;
        locationIdMap.set(location.id, newId);
        return {
          ...location,
          id: newId,
          levelId: levelIdMap.get(location.levelId)!,
          parentLocationId: null,
          code: `${id}-${location.path.join('-')}`,
        };
      });
      clone.locations = clone.locations.map((location, index) => ({
        ...location,
        parentLocationId: source.locations[index]?.parentLocationId
          ? locationIdMap.get(source.locations[index]!.parentLocationId) ?? null
          : null,
      }));

      if (input.scope === 'levels_and_locations') {
        clone.status = 'LEVELS_DEFINED';
        clone.ranges = [];
        clone.topMaps = [];
        clone.frontLayers = [];
      } else {
        clone.ranges = source.ranges.map((range) => ({
          ...range,
          locationId: locationIdMap.get(range.locationId)!,
        }));
        clone.topMaps = source.topMaps.map((map, index) => {
          let rewritten = map.source;
          source.locations.forEach((location) => {
            rewritten = rewritten.replaceAll(location.code, `${id}-${location.path.join('-')}`);
          });
          return {
            ...map,
            id: `${id}-top-${index + 1}`,
            source: rewritten,
            representedLevelIds: map.representedLevelIds.map((levelId) => levelIdMap.get(levelId)!),
          };
        });
        clone.frontLayers = source.frontLayers.map((layer, layerIndex) => {
          const variantIdMap = new Map<string, string>();
          const variants = layer.variants.map((variant, variantIndex) => {
            const variantId = `${id}-variant-${layerIndex + 1}-${variantIndex + 1}`;
            variantIdMap.set(variant.id, variantId);
            return { ...variant, id: variantId };
          });
          return {
            ...layer,
            id: `${id}-front-${layerIndex + 1}`,
            representedLevelId: levelIdMap.get(layer.representedLevelId)!,
            variants,
            assignments: Object.fromEntries(
              Object.entries(layer.assignments).map(([locationId, variantId]) => [
                locationIdMap.get(locationId)!,
                variantIdMap.get(variantId)!,
              ]),
            ),
          };
        });
        clone.status = clone.ranges.length === terminalLocations(clone).length ? 'ASSIGNED' : 'PARTIALLY_ASSIGNED';
      }
    }

    this.schemes.set(id, clone);
    return response(clone);
  }

  async replaceLevels(schemeId: string, inputs: ReplaceLevelInput[]) {
    const scheme = this.scheme(schemeId);
    this.editable(scheme);
    if (scheme.status !== 'DRAFT') fail(409, 'LEVELS_NOT_EDITABLE', 'Los niveles ya fueron confirmados.');
    if (!inputs.length) fail(422, 'LEVELS_REQUIRED', 'Añade al menos un nivel físico.');
    const terminalCount = inputs.filter((level) => level.isSearchTerminal).length;
    if (terminalCount !== 1) {
      fail(422, 'TERMINAL_LEVEL_REQUIRED', 'Selecciona un único nivel de captura de rangos.');
    }
    const keys = new Set(inputs.map((level) => level.key));
    if (keys.size !== inputs.length || inputs.some((level) => !level.name.trim())) {
      fail(422, 'INVALID_LEVELS', 'Los niveles necesitan nombres y claves únicas.');
    }
    scheme.levels = [...inputs]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((level, index) => ({ ...level, id: `${schemeId}-level-${index + 1}`, name: level.name.trim() }));
    this.touch(scheme);
    return response(scheme);
  }

  async confirmLevels(schemeId: string) {
    const scheme = this.scheme(schemeId);
    this.editable(scheme);
    if (scheme.status !== 'DRAFT') fail(409, 'LEVELS_ALREADY_CONFIRMED', 'Los niveles ya fueron confirmados.');
    if (!scheme.levels.length || !scheme.levels.some((level) => level.isSearchTerminal)) {
      fail(422, 'LEVELS_INCOMPLETE', 'Completa la definición de niveles antes de confirmar.');
    }
    scheme.status = 'LEVELS_DEFINED';
    this.touch(scheme);
    return response(scheme);
  }

  async addLocations(schemeId: string, input: AddLocationsInput) {
    const scheme = this.scheme(schemeId);
    this.editable(scheme);
    if (scheme.status !== 'LEVELS_DEFINED') {
      fail(409, 'LOCATIONS_NOT_EDITABLE', 'Las ubicaciones ya fueron confirmadas.');
    }
    if (!Number.isInteger(input.quantity) || input.quantity < 1 || input.quantity > 50) {
      fail(400, 'INVALID_QUANTITY', 'La cantidad debe estar entre 1 y 50.');
    }
    const parent = input.parentLocationId
      ? scheme.locations.find((location) => location.id === input.parentLocationId)
      : null;
    if (input.parentLocationId && !parent) fail(404, 'PARENT_LOCATION_NOT_FOUND', 'La ubicación padre no existe.');
    const parentLevelIndex = parent
      ? scheme.levels.findIndex((level) => level.id === parent.levelId)
      : -1;
    const childLevel = scheme.levels[parentLevelIndex + 1];
    if (!childLevel) fail(422, 'NO_CHILD_LEVEL', 'Esta ubicación no admite niveles descendientes.');
    if (input.schemeLevelId && input.schemeLevelId !== childLevel.id) {
      fail(422, 'CHILD_LEVEL_REQUIRED', 'La ubicación debe seguir el nivel definido.');
    }
    const siblings = scheme.locations.filter(
      (location) => location.parentLocationId === input.parentLocationId && location.levelId === childLevel.id,
    );
    const firstOrder = Math.max(0, ...siblings.map((location) => location.sortOrder)) + 1;
    const created: Location[] = [];
    for (let offset = 0; offset < input.quantity; offset += 1) {
      const ordinal = firstOrder + offset;
      const path = [...(parent?.path ?? []), ordinal];
      const location: Location = {
        id: `${schemeId}-location-${this.nextEntityId++}`,
        levelId: childLevel.id,
        parentLocationId: parent?.id ?? null,
        name: `${childLevel.name} ${ordinal}`,
        ordinal,
        sortOrder: ordinal,
        code: `${schemeId}-${path.join('-')}`,
        path,
      };
      scheme.locations.push(location);
      created.push(location);
    }
    this.touch(scheme);
    return response(created);
  }

  async deleteLocation(schemeId: string, locationId: string) {
    const scheme = this.scheme(schemeId);
    this.editable(scheme);
    if (scheme.status !== 'LEVELS_DEFINED') fail(409, 'LOCATIONS_NOT_EDITABLE', 'Las ubicaciones ya fueron confirmadas.');
    if (!scheme.locations.some((location) => location.id === locationId)) {
      fail(404, 'LOCATION_NOT_FOUND', 'La ubicación no existe.');
    }
    const remove = new Set([locationId]);
    let changed = true;
    while (changed) {
      changed = false;
      scheme.locations.forEach((location) => {
        if (location.parentLocationId && remove.has(location.parentLocationId) && !remove.has(location.id)) {
          remove.add(location.id);
          changed = true;
        }
      });
    }
    scheme.locations = scheme.locations.filter((location) => !remove.has(location.id));
    this.touch(scheme);
    return response(null);
  }

  async confirmLocations(schemeId: string) {
    const scheme = this.scheme(schemeId);
    this.editable(scheme);
    if (scheme.status !== 'LEVELS_DEFINED') fail(409, 'LOCATIONS_ALREADY_CONFIRMED', 'Las ubicaciones ya fueron confirmadas.');
    const terminal = scheme.levels.find((level) => level.isSearchTerminal);
    if (!terminal || !scheme.locations.some((location) => location.levelId === terminal.id)) {
      fail(422, 'INCOMPLETE_LOCATION_TREE', 'Crea al menos una rama completa hasta el nivel de captura.');
    }
    const incomplete = scheme.locations.filter((location) => {
      const levelIndex = scheme.levels.findIndex((level) => level.id === location.levelId);
      if (levelIndex >= scheme.levels.length - 1) return false;
      return !scheme.locations.some((child) => child.parentLocationId === location.id);
    });
    if (incomplete.length) {
      fail(422, 'INCOMPLETE_LOCATION_TREE', 'Todas las ramas deben llegar al nivel de captura.', incomplete.map((item) => item.name));
    }
    scheme.status = 'LOCATIONS_DEFINED';
    this.touch(scheme);
    return response(scheme);
  }

  async reopenLocations(schemeId: string, confirmDataLoss: true) {
    const scheme = this.scheme(schemeId);
    this.editable(scheme);
    if (!confirmDataLoss) fail(400, 'CONFIRM_DATA_LOSS_REQUIRED', 'Confirma la eliminación de mapas y rangos.');
    scheme.ranges = [];
    scheme.topMaps = [];
    scheme.frontLayers = [];
    scheme.status = 'LEVELS_DEFINED';
    this.touch(scheme);
    return response(scheme);
  }

  async reopenLevels(schemeId: string, confirmDataLoss: true) {
    const scheme = this.scheme(schemeId);
    this.editable(scheme);
    if (!confirmDataLoss) fail(400, 'CONFIRM_DATA_LOSS_REQUIRED', 'Confirma la eliminación de la estructura.');
    scheme.locations = [];
    scheme.ranges = [];
    scheme.topMaps = [];
    scheme.frontLayers = [];
    scheme.status = 'DRAFT';
    this.touch(scheme);
    return response(scheme);
  }

  private validateRange(scheme: Scheme, input: SaveRangeInput) {
    const location = terminalLocations(scheme).find((candidate) => candidate.id === input.locationId);
    if (!location) fail(422, 'RANGE_LOCATION_INVALID', 'El rango solo puede asignarse al nivel de captura.');
    const start = input.rangeStart.trim().toUpperCase().replace(/\s+/g, ' ');
    const end = input.rangeEnd.trim().toUpperCase().replace(/\s+/g, ' ');
    if (!start || !end) fail(422, 'INVALID_RANGE', 'Completa ambos extremos del rango.');
    if (start.localeCompare(end, undefined, { numeric: true }) > 0) {
      fail(422, 'INVERTED_RANGE', 'El inicio del rango no puede ser posterior al final.');
    }
    return { locationId: input.locationId, rangeStart: start, rangeEnd: end };
  }

  private deriveRangeStatus(scheme: Scheme) {
    const terminalCount = terminalLocations(scheme).length;
    if (!scheme.ranges.length) scheme.status = 'LOCATIONS_DEFINED';
    else if (scheme.ranges.length === terminalCount) scheme.status = 'ASSIGNED';
    else scheme.status = 'PARTIALLY_ASSIGNED';
  }

  async saveRange(schemeId: string, input: SaveRangeInput) {
    const scheme = this.scheme(schemeId);
    this.editable(scheme);
    if (!['LOCATIONS_DEFINED', 'PARTIALLY_ASSIGNED', 'ASSIGNED'].includes(scheme.status)) {
      fail(409, 'RANGES_NOT_EDITABLE', 'Confirma las ubicaciones antes de asignar rangos.');
    }
    const range = this.validateRange(scheme, input);
    scheme.ranges = [...scheme.ranges.filter((item) => item.locationId !== input.locationId), range];
    this.deriveRangeStatus(scheme);
    this.touch(scheme);
    return response(range);
  }

  async saveRanges(schemeId: string, items: SaveRangeInput[]) {
    const scheme = this.scheme(schemeId);
    this.editable(scheme);
    const ranges = items.map((item) => this.validateRange(scheme, item));
    const changed = new Set(ranges.map((item) => item.locationId));
    scheme.ranges = [...scheme.ranges.filter((item) => !changed.has(item.locationId)), ...ranges];
    this.deriveRangeStatus(scheme);
    this.touch(scheme);
    return response(ranges);
  }

  async deleteRange(schemeId: string, locationId: string) {
    const scheme = this.scheme(schemeId);
    this.editable(scheme);
    scheme.ranges = scheme.ranges.filter((range) => range.locationId !== locationId);
    this.deriveRangeStatus(scheme);
    this.touch(scheme);
    return response(null);
  }

  async saveTopMap(schemeId: string, input: SaveTopMapInput) {
    const scheme = this.scheme(schemeId);
    this.editable(scheme);
    if (!['LOCATIONS_DEFINED', 'PARTIALLY_ASSIGNED', 'ASSIGNED'].includes(scheme.status)) {
      fail(409, 'MAPS_NOT_EDITABLE', 'Confirma las ubicaciones antes de configurar mapas.');
    }
    if (!input.name.trim() || !input.representedLevelIds.length) {
      fail(422, 'MAP_METADATA_REQUIRED', 'Indica el nombre y al menos un nivel representado.');
    }
    const source = sanitizeSvgForPreview(input.source);
    if (!source.includes('data-location-code=')) {
      fail(422, 'TOP_CODES_REQUIRED', 'El SVG superior no contiene códigos de ubicación.');
    }
    scheme.topMaps.push({
      id: `${schemeId}-top-${this.nextEntityId++}`,
      name: input.name.trim(),
      svgName: input.svgName.trim() || input.name.trim(),
      source,
      representedLevelIds: input.representedLevelIds,
      enabled: true,
    });
    this.touch(scheme);
    return response(scheme);
  }

  async deleteTopMap(schemeId: string, mapId: string) {
    const scheme = this.scheme(schemeId);
    this.editable(scheme);
    scheme.topMaps = scheme.topMaps.filter((map) => map.id !== mapId);
    this.touch(scheme);
    return response(null);
  }

  async saveFrontVariant(schemeId: string, input: SaveFrontVariantInput) {
    const scheme = this.scheme(schemeId);
    this.editable(scheme);
    if (!input.layerName.trim() || !input.variantName.trim() || !input.variantCode.trim()) {
      fail(422, 'FRONT_METADATA_REQUIRED', 'Completa los datos de la capa y la variante.');
    }
    if (!Number.isInteger(input.slotCount) || input.slotCount < 1) {
      fail(422, 'INVALID_SLOT_COUNT', 'La variante necesita al menos un espacio.');
    }
    const source = sanitizeSvgForPreview(input.source);
    const slots = [...source.matchAll(/data-slot="(\d+)"/g)].map((match) => Number(match[1]));
    if (new Set(slots).size < input.slotCount) {
      fail(422, 'FRONT_SLOTS_REQUIRED', 'El SVG no contiene todos los espacios declarados.');
    }
    let layer = input.layerId
      ? scheme.frontLayers.find((candidate) => candidate.id === input.layerId)
      : undefined;
    if (!layer) {
      layer = {
        id: `${schemeId}-front-${this.nextEntityId++}`,
        name: input.layerName.trim(),
        representedLevelId: input.representedLevelId,
        enabled: true,
        variants: [],
        assignments: {},
      };
      scheme.frontLayers.push(layer);
    }
    layer.variants.push({
      id: `${schemeId}-variant-${this.nextEntityId++}`,
      name: input.variantName.trim(),
      variantCode: input.variantCode.trim(),
      slotCount: input.slotCount,
      source,
    });
    this.touch(scheme);
    return response(scheme);
  }

  async assignFrontVariant(
    schemeId: string,
    layerId: string,
    contextLocationId: string,
    variantId: string | null,
  ) {
    const scheme = this.scheme(schemeId);
    this.editable(scheme);
    const layer = scheme.frontLayers.find((candidate) => candidate.id === layerId);
    if (!layer) fail(404, 'FRONT_LAYER_NOT_FOUND', 'La capa frontal no existe.');
    if (variantId && !layer.variants.some((variant) => variant.id === variantId)) {
      fail(422, 'FRONT_VARIANT_INVALID', 'La variante no pertenece a la capa.');
    }
    if (variantId) layer.assignments[contextLocationId] = variantId;
    else delete layer.assignments[contextLocationId];
    this.touch(scheme);
    return response(scheme);
  }

  async deleteFrontLayer(schemeId: string, layerId: string) {
    const scheme = this.scheme(schemeId);
    this.editable(scheme);
    scheme.frontLayers = scheme.frontLayers.filter((layer) => layer.id !== layerId);
    this.touch(scheme);
    return response(null);
  }

  async validateMaps(schemeId: string) {
    return response(this.mapValidation(this.scheme(schemeId)));
  }

  private mapValidation(scheme: Scheme): MapValidation {
    const terminals = terminalLocations(scheme);
    const covered = terminals.filter((terminal) => scheme.topMaps.some((map) => {
      if (!map.enabled) return false;
      const representedAncestors = locationRoute(scheme, terminal).filter((ancestor) =>
        map.representedLevelIds.includes(ancestor.levelId),
      );
      return representedAncestors.some((ancestor) => map.source.includes(`data-location-code="${ancestor.code}"`));
    }));
    const frontWarnings: string[] = [];
    scheme.frontLayers.filter((layer) => layer.enabled).forEach((layer) => {
      if (!layer.variants.length) frontWarnings.push(`${layer.name}: falta una variante.`);
      const contexts = scheme.locations.filter((location) => location.levelId === layer.representedLevelId);
      const missing = contexts.filter((context) => !layer.assignments[context.id]);
      if (missing.length) frontWarnings.push(`${layer.name}: faltan ${missing.length} asignaciones.`);
    });
    return {
      ready: terminals.length > 0 && covered.length === terminals.length && frontWarnings.length === 0,
      topCoveredLocationIds: covered.map((location) => location.id),
      missingTopLocationIds: terminals.filter((location) => !covered.includes(location)).map((location) => location.id),
      frontWarnings,
    };
  }

  async reviewScheme(schemeId: string) {
    const scheme = this.scheme(schemeId);
    const terminals = terminalLocations(scheme);
    const ranged = new Set(scheme.ranges.map((range) => range.locationId));
    const missing = terminals.filter((location) => !ranged.has(location.id));
    const maps = this.mapValidation(scheme);
    const blockers: string[] = [];
    if (scheme.status !== 'ASSIGNED') blockers.push('Completa los rangos de todas las ubicaciones de captura.');
    if (!maps.ready) blockers.push('Completa la cobertura de mapas superiores y las capas frontales habilitadas.');
    const review: SchemeReview = {
      schemeId,
      levelCount: scheme.levels.length,
      locationCount: scheme.locations.length,
      terminalCount: terminals.length,
      assignedRangeCount: ranged.size,
      missingRangeLocationIds: missing.map((location) => location.id),
      mapValidation: maps,
      blockers,
      publishable: blockers.length === 0 && !scheme.publishedAt,
    };
    return response(review);
  }

  async publishScheme(schemeId: string, activate: boolean) {
    const scheme = this.scheme(schemeId);
    this.editable(scheme);
    const review = (await this.reviewScheme(schemeId)).data;
    if (!review.publishable) {
      fail(422, 'SCHEME_NOT_PUBLISHABLE', 'El esquema todavía no se puede publicar.', review.blockers);
    }
    scheme.publishedAt = now();
    if (activate) this.activate(scheme);
    this.touch(scheme);
    return response(scheme);
  }

  async activateScheme(schemeId: string) {
    const scheme = this.scheme(schemeId);
    if (!scheme.publishedAt || scheme.status !== 'ASSIGNED') {
      fail(409, 'SCHEME_NOT_PUBLISHED', 'Solo se puede activar un esquema publicado.');
    }
    this.activate(scheme);
    this.touch(scheme);
    return response(scheme);
  }

  private activate(scheme: Scheme) {
    this.schemes.forEach((candidate) => {
      candidate.isActive = false;
    });
    scheme.isActive = true;
  }

  async searchTests(schemeId: string, callNumber: string) {
    const scheme = this.scheme(schemeId);
    if (!schemeCanRunSearchTests(scheme)) {
      fail(409, 'SCHEME_NOT_SEARCHABLE', 'El esquema todavía no tiene rangos para probar la búsqueda.');
    }
    const query = callNumber.trim();
    if (!query) fail(400, 'CALL_NUMBER_REQUIRED', 'Escribe una signatura para probar.');
    const normalized = query.toUpperCase().replace(/\s+/g, ' ');
    const matchedRanges = scheme.ranges.filter((range) =>
      range.rangeStart.localeCompare(normalized, undefined, { numeric: true }) <= 0
        && range.rangeEnd.localeCompare(normalized, undefined, { numeric: true }) >= 0,
    );
    const matches: SearchMatch[] = matchedRanges.slice(0, 8).flatMap((range) => {
      const location = scheme.locations.find((candidate) => candidate.id === range.locationId);
      if (!location) return [];
      return [{
        locationId: location.id,
        name: location.name,
        code: location.code,
        rangeStart: range.rangeStart,
        rangeEnd: range.rangeEnd,
        route: locationRoute(scheme, location).map((item) => ({ name: item.name, code: item.code })),
      }];
    });
    const topViews = scheme.topMaps.filter((map) => map.enabled).flatMap((map) => {
      const codes = [...new Set(matches.flatMap((match) => {
        const terminal = scheme.locations.find((location) => location.id === match.locationId);
        return terminal
          ? locationRoute(scheme, terminal)
              .filter((location) => map.representedLevelIds.includes(location.levelId))
              .map((location) => location.code)
          : [];
      }))];
      return codes.length ? [{
        name: map.name,
        source: highlightSvg(map.source, 'data-location-code', codes),
        highlightLocationCodes: codes,
      }] : [];
    });
    const frontViews = scheme.frontLayers.filter((layer) => layer.enabled).flatMap((layer) => {
      const grouped = new Map<string, { context: Location; variantId: string; slots: number[] }>();
      matches.forEach((match) => {
        const terminal = scheme.locations.find((location) => location.id === match.locationId);
        if (!terminal) return;
        const route = locationRoute(scheme, terminal);
        const contextIndex = route.findIndex((location) => location.levelId === layer.representedLevelId);
        const context = route[contextIndex];
        if (!context) return;
        const variantId = layer.assignments[context.id];
        if (!variantId) return;
        const group = grouped.get(context.id) ?? { context, variantId, slots: [] };
        const slot = route[contextIndex + 1]?.ordinal;
        if (slot) group.slots.push(slot);
        grouped.set(context.id, group);
      });
      return [...grouped.values()].flatMap((group) => {
        const variant = layer.variants.find((candidate) => candidate.id === group.variantId);
        if (!variant) return [];
        const slots = [...new Set(group.slots)];
        return [{
          name: `${group.context.name}; ${slots.length} ${slots.length === 1 ? 'resultado' : 'resultados'}`,
          source: highlightSvg(variant.source, 'data-slot', slots),
          highlightSlots: slots,
        }];
      });
    });
    const result: SearchTestResult = {
      query,
      normalized,
      schemeId,
      schemeName: scheme.name,
      matches,
      maps: { topViews, frontViews },
    };
    return response(result);
  }

  async exportLocationsCsv(schemeId: string) {
    const scheme = this.scheme(schemeId);
    const escape = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`;
    const lines = [
      ['location_code', 'name', 'level_name', 'sort_order'],
      ...scheme.locations.map((location) => [
        location.code,
        location.name,
        scheme.levels.find((level) => level.id === location.levelId)?.name ?? '',
        location.sortOrder,
      ]),
    ];
    return response(lines.map((line) => line.map(escape).join(',')).join('\r\n'));
  }
}
