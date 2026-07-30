import type { Registro } from '@bjff/api-types';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { api } from '../api/client.js';

/** Tamaño de página fijado por FR-009 de 002-load-management. */
const PAGE_SIZE = 100;

export function LoadBooksPage() {
  const { id } = useParams();
  const loadId = Number(id);

  const [items, setItems] = useState<Registro[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [withoutKey, setWithoutKey] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!Number.isFinite(loadId)) return;

    setItems(null);
    api
      .books(loadId, page, PAGE_SIZE, withoutKey)
      .then((result) => {
        setItems(result.items);
        setTotal(result.total);
      })
      .catch(() => setError('No se pudieron obtener los registros.'));
  }, [loadId, page, withoutKey]);

  if (error) {
    return (
      <p role="alert" className="text-red-700 dark:text-red-400">
        {error}
      </p>
    );
  }

  const totalPages = Math.max(Math.ceil(total / PAGE_SIZE), 1);
  const first = total === 0 ? 0 : page * PAGE_SIZE + 1;
  const last = Math.min((page + 1) * PAGE_SIZE, total);

  return (
    <section>
      <p className="mb-2 text-sm">
        <Link className="underline underline-offset-4" to={`/cargas/${loadId}`}>
          Volver al detalle de la carga
        </Link>
      </p>

      <h2 className="mb-4 text-xl font-semibold">Registros de la carga</h2>

      <label className="mb-4 flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={withoutKey}
          onChange={(event) => {
            setWithoutKey(event.target.checked);
            setPage(0);
          }}
        />
        Mostrar solo los registros sin clave comparable
      </label>

      {!items ? (
        <p role="status">Cargando…</p>
      ) : total === 0 ? (
        <p className="text-slate-600 dark:text-slate-400">
          Esta carga no tiene registros que mostrar.
        </p>
      ) : (
        <>
          <p
            role="status"
            aria-live="polite"
            className="mb-3 text-sm text-slate-600 dark:text-slate-400"
          >
            Registros {first}–{last} de {total} · página {page + 1} de {totalPages}
          </p>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <caption className="sr-only">
                Registros de la carga, ordenados por su fila de origen en el archivo.
              </caption>
              <thead>
                <tr className="border-b border-slate-300 text-left dark:border-slate-700">
                  <th scope="col" className="py-2 pr-4">Fila</th>
                  <th scope="col" className="py-2 pr-4">Código de barras</th>
                  <th scope="col" className="py-2 pr-4">Clasificación original</th>
                  <th scope="col" className="py-2 pr-4">Clave comparable</th>
                  <th scope="col" className="py-2">Título</th>
                </tr>
              </thead>
              <tbody>
                {items.map((book) => (
                  <tr
                    key={book.bookId}
                    className="border-b border-slate-200 dark:border-slate-800"
                  >
                    <td className="py-2 pr-4 tabular-nums">{book.sourceRowNumber}</td>
                    <td className="py-2 pr-4">{book.sourceBarcode}</td>
                    <td className="py-2 pr-4 font-mono text-xs">
                      {book.classificationRaw ?? <Ausente />}
                    </td>
                    <td className="py-2 pr-4 font-mono text-xs">
                      {book.comparableKey ?? (
                        <span className="text-amber-700 dark:text-amber-400">
                          sin clave
                        </span>
                      )}
                    </td>
                    <td className="py-2">{book.title ?? <Ausente />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <nav aria-label="Paginación de registros" className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => setPage((current) => Math.max(current - 1, 0))}
              disabled={page === 0}
              className="rounded border border-slate-300 px-3 py-1 text-sm hover:bg-slate-100 disabled:opacity-40 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              Anterior
            </button>
            <button
              type="button"
              onClick={() => setPage((current) => current + 1)}
              disabled={page + 1 >= totalPages}
              className="rounded border border-slate-300 px-3 py-1 text-sm hover:bg-slate-100 disabled:opacity-40 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              Siguiente
            </button>
          </nav>
        </>
      )}
    </section>
  );
}

/** Dato ausente, distinguible de un valor vacío (FR-016). */
function Ausente() {
  return (
    <span className="text-slate-500" aria-label="sin dato">
      —
    </span>
  );
}
