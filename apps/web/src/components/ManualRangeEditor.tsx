import type { ManualRangeInput } from '@bjff/api-types';

interface PositionOption {
  locationId: number;
  positionSequence: number;
  path: string;
}

export function ManualRangeEditor({
  positions,
  ranges,
  onChange,
}: {
  positions: PositionOption[];
  ranges: ManualRangeInput[];
  onChange: (ranges: ManualRangeInput[]) => void;
}) {
  const boundaryByLocation = new Map(
    ranges.slice(1).map((range) => [range.locationId, range.startCode ?? '']),
  );

  function updateBoundary(locationId: number, code: string) {
    const boundaries = new Map(boundaryByLocation);
    boundaries.set(locationId, code);
    onChange(buildRanges(positions, boundaries));
  }

  return (
    <fieldset className="surface mt-5 p-5">
      <legend className="px-1 font-semibold text-[#002855]">Cobertura manual</legend>
      <p className="helper-text mb-4">
        La cobertura comienza en el inicio global y termina en el final global. Definí el
        código donde empieza cada posición posterior; el final anterior se enlaza
        automáticamente para evitar huecos y solapamientos.
      </p>
      <div className="grid gap-3">
        {positions.map((position, index) => (
          <label
            key={position.locationId}
            className="grid items-center gap-2 text-sm md:grid-cols-[minmax(0,1fr)_minmax(180px,0.45fr)]"
          >
            <span>
              <strong className="block text-[#002855]">{position.path}</strong>
              <small className="helper-text">Posición {position.positionSequence}</small>
            </span>
            {index === 0 ? (
              <span className="rounded bg-slate-100 px-3 py-2 text-slate-600">
                Inicio global
              </span>
            ) : (
              <input
                required
                value={boundaryByLocation.get(position.locationId) ?? ''}
                onChange={(event) =>
                  updateBoundary(position.locationId, event.target.value)
                }
                placeholder="Código de inicio"
                maxLength={60}
                aria-label={`Código de inicio para ${position.path}`}
              />
            )}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function buildRanges(
  positions: PositionOption[],
  boundaries: Map<number, string>,
): ManualRangeInput[] {
  return positions.map((position, index) => ({
    locationId: position.locationId,
    startCode: index === 0 ? null : boundaries.get(position.locationId) || null,
    endCode:
      index === positions.length - 1
        ? null
        : boundaries.get(positions[index + 1]!.locationId) || null,
  }));
}
