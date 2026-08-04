import type { AnchorInput, DistributionPositionInput } from '@bjff/api-types';

export function AnchorEditor({
  positions,
  anchors,
  onChange,
}: {
  positions: Array<
    Pick<DistributionPositionInput, 'locationId' | 'positionSequence' | 'path'>
  >;
  anchors: AnchorInput[];
  onChange: (anchors: AnchorInput[]) => void;
}) {
  const byLocation = new Map(anchors.map((anchor) => [anchor.locationId, anchor]));

  function update(locationId: number, boundaryCode: string) {
    const next = anchors.filter((anchor) => anchor.locationId !== locationId);
    if (boundaryCode.trim()) next.push({ locationId, boundaryCode });
    const order = new Map(
      positions.map((position, index) => [position.locationId, index]),
    );
    onChange(
      next.sort(
        (left, right) =>
          (order.get(left.locationId) ?? 0) - (order.get(right.locationId) ?? 0),
      ),
    );
  }

  return (
    <fieldset className="surface mt-5 p-5">
      <legend className="px-1 font-semibold text-[#002855]">Fronteras ancladas</legend>
      <p className="helper-text mb-4">
        Escribí el código legible que inicia cada posición. La primera posición siempre
        comienza en el inicio global. Las claves normalizadas las calcula el servidor.
      </p>
      <div className="grid gap-3">
        {positions.slice(1).map((position) => (
          <label
            key={position.locationId}
            className="grid items-center gap-2 text-sm md:grid-cols-[minmax(0,1fr)_minmax(180px,0.45fr)]"
          >
            <span>
              <strong className="block text-[#002855]">{position.path}</strong>
              <small className="helper-text">Posición {position.positionSequence}</small>
            </span>
            <input
              value={byLocation.get(position.locationId)?.boundaryCode ?? ''}
              onChange={(event) => update(position.locationId, event.target.value)}
              placeholder="Código de inicio"
              maxLength={60}
              aria-label={`Código de inicio para ${position.path}`}
            />
          </label>
        ))}
      </div>
    </fieldset>
  );
}
