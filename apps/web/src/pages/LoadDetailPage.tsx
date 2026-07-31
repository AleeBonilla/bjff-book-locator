import type { Carga, ProblemaDeCarga } from '@bjff/api-types';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { api } from '../api/client.js';
import { Counters, StatusBadge } from '../components/Counters.js';

export function LoadDetailPage() {
  const { id } = useParams();
  const loadId = Number(id);

  const [load, setLoad] = useState<Carga | null>(null);
  const [problems, setProblems] = useState<ProblemaDeCarga[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!Number.isFinite(loadId)) return;

    Promise.all([api.load(loadId), api.problems(loadId)])
      .then(([detail, page]) => {
        setLoad(detail);
        setProblems(page.items);
      })
      .catch(() => setError('No se pudo obtener la carga.'));
  }, [loadId]);

  if (error) {
    return (
      <p role="alert" className="text-red-700 dark:text-red-400">
        {error}
      </p>
    );
  }

  if (!load || !problems) return <p role="status">Cargando…</p>;

  return (
    <section>
      <div className="mb-2 flex flex-wrap items-center gap-3">
        <h2 className="text-xl font-semibold">{load.title}</h2>
        <StatusBadge status={load.status} />
      </div>

      <p className="mb-6 text-sm text-slate-600 dark:text-slate-400">
        {load.filename} · {new Date(load.createdAt).toLocaleString('es-CR')}
        {load.createdBy ? ` · ${load.createdBy.username}` : ''}
      </p>

      {load.errorMessage && (
        <p className="mb-6 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
          {load.errorMessage} Ningún registro de esta carga queda disponible.
        </p>
      )}

      <Counters counters={load.counters} />

      <p className="mt-4 text-sm">
        <Link className="underline underline-offset-4" to={`/cargas/${loadId}/registros`}>
          Ver los registros de la carga
        </Link>
      </p>

      <h3 className="mt-8 mb-3 text-lg font-semibold">
        Problemas ({problems.length})
      </h3>

      {problems.length === 0 ? (
        <p className="text-slate-600 dark:text-slate-400">
          No se registraron problemas en esta carga.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <caption className="sr-only">
              Problemas de la carga, ordenados por número de fila del archivo.
            </caption>
            <thead>
              <tr className="border-b border-slate-300 text-left dark:border-slate-700">
                <th scope="col" className="py-2 pr-4">Fila</th>
                <th scope="col" className="py-2 pr-4">Severidad</th>
                <th scope="col" className="py-2 pr-4">Código</th>
                <th scope="col" className="py-2">Motivo</th>
              </tr>
            </thead>
            <tbody>
              {problems.map((problem) => (
                <tr
                  key={problem.collectionLoadErrorId}
                  className="border-b border-slate-200 dark:border-slate-800"
                >
                  <td className="py-2 pr-4 tabular-nums">{problem.rowNumber}</td>
                  <td className="py-2 pr-4">
                    {problem.severity === 'REVIEW' ? 'Revisable' : 'Rechazada'}
                  </td>
                  <td className="py-2 pr-4 font-mono text-xs whitespace-nowrap">
                    {problem.classificationRaw ?? (
                      <span className="font-sans text-slate-500">sin código</span>
                    )}
                  </td>
                  <td className="py-2">{problem.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
