import type { DistributionRunSummary } from '@bjff/api-types';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { ApiRequestError, api } from '../api/client.js';

export function DistributionRunsPage() {
  const [runs, setRuns] = useState<DistributionRunSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const reload = useCallback(async () => {
    const page = await api.distributionRuns();
    setRuns(page.items);
  }, []);

  useEffect(() => {
    void reload().catch(() => setError('No se pudieron obtener las corridas.'));
  }, [reload]);

  async function restore(run: DistributionRunSummary) {
    const warning =
      run.counters.unassignedCount > 0
        ? ` Esta versión tiene ${run.counters.unassignedCount} registros sin asignar.`
        : '';
    if (
      !window.confirm(
        `¿Querés publicar nuevamente la corrida ${run.distributionRunId}?${warning}`,
      )
    ) {
      return;
    }
    setBusyId(run.distributionRunId);
    setError(null);
    try {
      await api.publishDistributionRun(run.distributionRunId, {
        expectedRevision: run.revision,
        previewAccepted: true,
        unassignedAccepted: run.counters.unassignedCount > 0,
      });
      await reload();
    } catch (cause) {
      setError(
        cause instanceof ApiRequestError
          ? cause.message
          : 'No se pudo restaurar la versión.',
      );
      await reload().catch(() => undefined);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-[#002855]">Distribuciones</h2>
          <p className="helper-text mt-1">
            Calculá propuestas, compará el historial y elegí la versión pública.
          </p>
        </div>
        <Link to="/esquemas/distribuciones/nueva" className="button-primary">
          Nueva corrida
        </Link>
      </div>
      {error ? (
        <p role="alert" className="mt-4 text-sm text-red-700">
          {error}
        </p>
      ) : null}
      <div className="mt-5 grid gap-3">
        {runs.map((run) => (
          <article key={run.distributionRunId} className="surface p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <Link
                  to={`/esquemas/distribuciones/${run.distributionRunId}`}
                  className="font-semibold text-[#002855]"
                >
                  Corrida {run.distributionRunId}
                </Link>
                {run.basedOnDistributionRunId ? (
                  <p className="helper-text mt-1">
                    Derivada de la corrida {run.basedOnDistributionRunId}
                  </p>
                ) : (
                  <p className="helper-text mt-1">Versión inicial</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                {run.isPublished ? <span className="status-pill">Pública</span> : null}
                <span className="status-pill">{statusLabel(run.status)}</span>
              </div>
            </div>
            <p className="helper-text mt-2">
              {strategyLabel(run.strategy)}. {run.counters.bookCount} registros,{' '}
              {run.counters.positionCount} posiciones. Revisión {run.revision}.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link
                to={`/esquemas/distribuciones/${run.distributionRunId}`}
                className="button-secondary"
              >
                Ver detalle y comparación
              </Link>
              {run.status === 'DONE' ? (
                <Link
                  to={`/esquemas/distribuciones/nueva?base=${run.distributionRunId}`}
                  className="button-secondary"
                >
                  Crear derivada
                </Link>
              ) : null}
              {run.status === 'DONE' && !run.isPublished ? (
                <button
                  type="button"
                  className="button-secondary"
                  disabled={busyId !== null}
                  onClick={() => void restore(run)}
                >
                  {busyId === run.distributionRunId
                    ? 'Restaurando...'
                    : 'Publicar esta versión'}
                </button>
              ) : null}
            </div>
          </article>
        ))}
        {runs.length === 0 && !error ? (
          <p className="surface p-5 text-sm text-slate-600">
            Todavía no hay corridas de distribución.
          </p>
        ) : null}
      </div>
    </section>
  );
}

function statusLabel(status: DistributionRunSummary['status']): string {
  return { PENDING: 'Calculando', DONE: 'Terminada', ERROR: 'Con error' }[status];
}

function strategyLabel(strategy: DistributionRunSummary['strategy']): string {
  return {
    HYBRID: 'Híbrida',
    CAPACITY: 'Por capacidad',
    WEIGHTED: 'Ponderada',
    ANCHORED: 'Anclada',
    MANUAL: 'Manual',
  }[strategy];
}
