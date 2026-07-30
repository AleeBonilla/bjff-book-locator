import type { LoadCounters, LoadStatus } from '@bjff/api-types';

const LABELS: Record<keyof LoadCounters, string> = {
  rowsRead: 'Filas leídas',
  rowsImported: 'Importadas',
  rowsWithoutKey: 'Sin clave comparable',
  rowsFlagged: 'Marcadas para revisión',
  rowsRejected: 'Rechazadas',
};

export function Counters({ counters }: { counters: LoadCounters }) {
  return (
    <dl className="grid grid-cols-2 gap-4 sm:grid-cols-5">
      {(Object.keys(LABELS) as Array<keyof LoadCounters>).map((key) => (
        <div key={key} className="rounded border border-slate-200 p-3 dark:border-slate-800">
          <dt className="text-xs text-slate-600 dark:text-slate-400">{LABELS[key]}</dt>
          <dd className="text-xl font-semibold tabular-nums">{counters[key]}</dd>
        </div>
      ))}
    </dl>
  );
}

export function StatusBadge({ status }: { status: LoadStatus }) {
  const styles: Record<LoadStatus, string> = {
    DONE: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900 dark:text-emerald-100',
    ERROR: 'bg-red-100 text-red-900 dark:bg-red-900 dark:text-red-100',
    PENDING: 'bg-amber-100 text-amber-900 dark:bg-amber-900 dark:text-amber-100',
  };

  return (
    <span className={`rounded px-2 py-0.5 text-xs font-medium ${styles[status]}`}>
      {status}
    </span>
  );
}
