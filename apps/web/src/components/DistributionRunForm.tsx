import type {
  AnchorInput,
  CreateDistributionRunRequest,
  DistributionStrategy,
  ManualRangeInput,
  ResumenDeCarga,
  Scheme,
  SchemeLocation,
} from '@bjff/api-types';
import { useEffect, useState, type FormEvent } from 'react';

import { api } from '../api/client.js';
import { AnchorEditor } from './AnchorEditor.js';
import { buildRanges, ManualRangeEditor } from './ManualRangeEditor.js';

interface Props {
  schemes: Scheme[];
  loads: ResumenDeCarga[];
  busy: boolean;
  initialCommand?: CreateDistributionRunRequest;
  schemeLocked?: boolean;
  onSubmit: (command: CreateDistributionRunRequest) => Promise<void>;
}

interface PositionOption {
  locationId: number;
  positionSequence: number;
  path: string;
}

export function DistributionRunForm({
  schemes,
  loads,
  busy,
  initialCommand,
  schemeLocked = false,
  onSubmit,
}: Props) {
  const [schemeId, setSchemeId] = useState<number | ''>(initialCommand?.schemeId ?? '');
  const [loadId, setLoadId] = useState<number | ''>(
    initialCommand?.collectionLoadId ?? '',
  );
  const [strategy, setStrategy] = useState<DistributionStrategy>(
    initialCommand?.strategy ?? 'HYBRID',
  );
  const [capacityValue, setCapacityValue] = useState(
    String(initialCommand?.defaults.capacity?.value ?? 40),
  );
  const [capacityUnit, setCapacityUnit] = useState<'BOOKS' | 'CENTIMETERS' | 'WEIGHT'>(
    initialCommand?.defaults.capacity?.unit ?? 'BOOKS',
  );
  const [targetFillRatio, setTargetFillRatio] = useState(
    String(initialCommand?.defaults.targetFillRatio ?? 0.85),
  );
  const [allowOverflow, setAllowOverflow] = useState(
    initialCommand?.defaults.allowOverflow ?? false,
  );
  const [positions, setPositions] = useState<PositionOption[]>([]);
  const [anchors, setAnchors] = useState<AnchorInput[]>(initialCommand?.anchors ?? []);
  const [manualRanges, setManualRanges] = useState<ManualRangeInput[]>(
    initialCommand?.manualRanges ?? [],
  );
  const [loadingPositions, setLoadingPositions] = useState(false);

  useEffect(() => {
    if (!initialCommand) return;
    setLoadingPositions(true);
    void api
      .scheme(initialCommand.schemeId)
      .then((detail) => setPositions(flattenPositions(detail.locations)))
      .finally(() => setLoadingPositions(false));
  }, [initialCommand]);

  async function selectScheme(value: string) {
    const selected = value === '' ? '' : Number(value);
    setSchemeId(selected);
    setAnchors([]);
    setManualRanges([]);
    setPositions([]);
    if (selected === '') return;
    setLoadingPositions(true);
    try {
      const detail = await api.scheme(selected);
      const nextPositions = flattenPositions(detail.locations);
      setPositions(nextPositions);
      if (strategy === 'MANUAL') {
        setManualRanges(buildRanges(nextPositions, new Map()));
      }
    } finally {
      setLoadingPositions(false);
    }
  }

  function selectStrategy(next: DistributionStrategy) {
    setStrategy(next);
    if (next === 'CAPACITY') setCapacityUnit('BOOKS');
    if (next === 'WEIGHTED' && capacityUnit === 'BOOKS') setCapacityUnit('WEIGHT');
    if (next !== 'ANCHORED' && next !== 'HYBRID') setAnchors([]);
    if (next === 'MANUAL') {
      setAnchors([]);
      setManualRanges(buildRanges(positions, new Map()));
    } else {
      setManualRanges([]);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (schemeId === '' || loadId === '') return;
    await onSubmit({
      schemeId,
      collectionLoadId: loadId,
      strategy,
      basedOnDistributionRunId: initialCommand?.basedOnDistributionRunId ?? null,
      defaults: {
        capacity: { value: Number(capacityValue), unit: capacityUnit },
        targetFillRatio: Number(targetFillRatio),
        allowOverflow,
      },
      anchors,
      manualRanges,
    });
  }

  const relativeUnits =
    strategy === 'WEIGHTED' || (strategy === 'HYBRID' && capacityUnit !== 'BOOKS');

  return (
    <form onSubmit={(event) => void submit(event)} className="surface p-5">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-1 text-sm">
          Esquema físico
          <select
            required
            disabled={schemeLocked}
            value={schemeId}
            onChange={(event) => void selectScheme(event.target.value)}
          >
            <option value="">Seleccioná un esquema</option>
            {schemes.map((scheme) => (
              <option key={scheme.schemeId} value={scheme.schemeId}>
                {scheme.name}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          Carga de colección
          <select
            required
            value={loadId}
            onChange={(event) =>
              setLoadId(event.target.value === '' ? '' : Number(event.target.value))
            }
          >
            <option value="">Seleccioná una carga terminada</option>
            {loads.map((load) => (
              <option key={load.collectionLoadId} value={load.collectionLoadId}>
                {load.title}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          Estrategia
          <select
            value={strategy}
            onChange={(event) =>
              selectStrategy(event.target.value as DistributionStrategy)
            }
          >
            <option value="HYBRID">Híbrida</option>
            <option value="CAPACITY">Por capacidad</option>
            <option value="WEIGHTED">Ponderada</option>
            <option value="ANCHORED">Anclada</option>
            <option value="MANUAL">Manual</option>
          </select>
        </label>
        <div className="grid grid-cols-[1fr_1.2fr] gap-3">
          <label className="grid gap-1 text-sm">
            {relativeUnits ? 'Peso relativo' : 'Capacidad'}
            <input
              data-testid="capacity-value"
              type="number"
              required
              min="0.01"
              step="0.01"
              value={capacityValue}
              onChange={(event) => setCapacityValue(event.target.value)}
            />
          </label>
          <label className="grid gap-1 text-sm">
            Unidad
            <select
              data-testid="capacity-unit"
              value={capacityUnit}
              onChange={(event) =>
                setCapacityUnit(event.target.value as 'BOOKS' | 'CENTIMETERS' | 'WEIGHT')
              }
              disabled={strategy === 'CAPACITY'}
            >
              {strategy !== 'WEIGHTED' && <option value="BOOKS">Libros</option>}
              {strategy !== 'CAPACITY' && (
                <option value="CENTIMETERS">Centímetros</option>
              )}
              {strategy !== 'CAPACITY' && <option value="WEIGHT">Peso relativo</option>}
            </select>
            {strategy === 'CAPACITY' ? (
              <span className="helper-text">Esta estrategia siempre usa libros.</span>
            ) : null}
          </label>
        </div>
        <label className="grid gap-1 text-sm">
          Objetivo de llenado
          <input
            data-testid="target-fill-ratio"
            type="number"
            required
            min="0.0001"
            max="1"
            step="0.0001"
            value={targetFillRatio}
            onChange={(event) => setTargetFillRatio(event.target.value)}
          />
          <span className="helper-text">1 equivale al 100 % de la capacidad.</span>
        </label>
        <label className="setting-toggle text-sm">
          <span className="setting-toggle-copy">
            <strong>Permitir superar el objetivo aproximado</strong>
            <small>
              Mantiene junta una misma clave aunque exceda el objetivo calculado.
            </small>
          </span>
          <input
            type="checkbox"
            checked={allowOverflow}
            onChange={(event) => setAllowOverflow(event.target.checked)}
          />
        </label>
      </div>

      {loadingPositions ? (
        <p className="helper-text mt-4">Cargando posiciones...</p>
      ) : null}
      {(strategy === 'HYBRID' || strategy === 'ANCHORED') && positions.length > 1 ? (
        <AnchorEditor positions={positions} anchors={anchors} onChange={setAnchors} />
      ) : null}
      {strategy === 'MANUAL' && positions.length > 0 ? (
        <ManualRangeEditor
          positions={positions}
          ranges={manualRanges}
          onChange={setManualRanges}
        />
      ) : null}

      <p className="helper-text mt-4">{strategyHelp(strategy, positions.length)}</p>
      <button
        disabled={busy || loadingPositions || schemeId === '' || loadId === ''}
        className="button-primary mt-4"
      >
        {busy ? 'Calculando...' : 'Crear y calcular'}
      </button>
    </form>
  );
}

function flattenPositions(
  locations: SchemeLocation[],
  parentPath: string[] = [],
): PositionOption[] {
  return locations
    .flatMap((location) => {
      const path = [...parentPath, location.name];
      const current =
        location.role === 'POSITION' && location.usable && location.leafSequence !== null
          ? [
              {
                locationId: location.locationId,
                positionSequence: location.leafSequence,
                path: path.join(' / '),
              },
            ]
          : [];
      return [...current, ...flattenPositions(location.children, path)];
    })
    .sort((left, right) => left.positionSequence - right.positionSequence);
}

function strategyHelp(strategy: DistributionStrategy, positionCount: number): string {
  switch (strategy) {
    case 'CAPACITY':
      return 'Usa capacidades en libros y no admite fronteras ancladas.';
    case 'WEIGHTED':
      return 'Reparte según pesos relativos con una misma unidad en todas las posiciones.';
    case 'ANCHORED':
      if (positionCount === 1) {
        return 'El esquema tiene una sola posición, por eso no hay fronteras internas que configurar.';
      }
      return 'Requiere un código de inicio para cada posición posterior a la primera.';
    case 'MANUAL':
      return 'Requiere una cobertura continua desde el inicio hasta el final global.';
    default:
      if (positionCount === 1) {
        return 'El esquema tiene una sola posición, por eso no hay fronteras internas que configurar. La unidad elegida define cómo se interpreta su capacidad.';
      }
      return 'Combina capacidades o pesos compatibles con fronteras ancladas opcionales.';
  }
}
