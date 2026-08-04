import type { DistributionWarnings as WarningCounts } from '@bjff/api-types';

export function DistributionWarnings({ warnings }: { warnings: WarningCounts }) {
  const items = [
    ['Registros sin asignar', warnings.unassignedCount],
    ['Posiciones vacías', warnings.emptyPositionCount],
    ['Posiciones sobrecargadas', warnings.overloadedPositionCount],
    ['Claves divididas', warnings.splitKeyCount],
  ] as const;

  return (
    <section className="surface p-5" aria-labelledby="distribution-warnings-title">
      <h3 id="distribution-warnings-title" className="font-semibold text-[#002855]">
        Advertencias de la vista previa
      </h3>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {items.map(([label, value]) => (
          <div key={label} className="rounded border border-slate-200 p-3">
            <span className="helper-text">{label}</span>
            <strong className="mt-1 block text-xl text-[#002855]">{value}</strong>
          </div>
        ))}
      </div>
      <p className="helper-text mt-3">
        Son estimaciones para revisión. No confirman la presencia física de ejemplares.
      </p>
    </section>
  );
}
