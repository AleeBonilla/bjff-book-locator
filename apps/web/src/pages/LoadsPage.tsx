import type { ResumenDeCarga } from '@bjff/api-types';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import { ApiRequestError, api } from '../api/client.js';
import { StatusBadge } from '../components/Counters.js';

export function LoadsPage() {
  const [items, setItems] = useState<ResumenDeCarga[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<number | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function reload(): void {
    api
      .loads()
      .then((page) => setItems(page.items))
      .catch(() => setError('No se pudieron obtener las cargas.'));
  }

  useEffect(reload, []);

  async function handleDelete(load: ResumenDeCarga): Promise<void> {
    setBusy(load.collectionLoadId);
    setError(null);
    try {
      await api.deleteLoad(load.collectionLoadId);
      setConfirming(null);
      setNotice(`Se eliminó la carga «${load.title}».`);
      reload();
    } catch (cause) {
      setError(
        cause instanceof ApiRequestError ? cause.message : 'No se pudo eliminar.',
      );
    } finally {
      setBusy(null);
    }
  }

  if (error && !items) {
    return (
      <p role="alert" className="text-red-700 dark:text-red-400">
        {error}
      </p>
    );
  }

  if (!items) return <p role="status">Cargando…</p>;

  return (
    <section>
      <h2 className="mb-4 text-xl font-semibold">Cargas de colección</h2>

      <p role="status" aria-live="polite" className="min-h-5 text-sm text-slate-600 dark:text-slate-400">
        {notice}
      </p>
      <p role="alert" aria-live="assertive" className="min-h-5 text-sm text-red-700 dark:text-red-400">
        {error}
      </p>

      {items.length === 0 ? (
        <p className="text-slate-600 dark:text-slate-400">
          Todavía no hay ninguna carga.{' '}
          <Link className="underline underline-offset-4" to="/cargas/importar">
            Importar una colección
          </Link>
          .
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <caption className="sr-only">
              Cargas de colección ordenadas por fecha de creación, de la más reciente a
              la más antigua.
            </caption>
            <thead>
              <tr className="border-b border-slate-300 text-left dark:border-slate-700">
                <th scope="col" className="py-2 pr-4">Título</th>
                <th scope="col" className="py-2 pr-4">Estado</th>
                <th scope="col" className="py-2 pr-4 text-right">Leídas</th>
                <th scope="col" className="py-2 pr-4 text-right">Importadas</th>
                <th scope="col" className="py-2 pr-4 text-right">Revisión</th>
                <th scope="col" className="py-2 pr-4 text-right">Rechazadas</th>
                <th scope="col" className="py-2 pr-4">Fecha</th>
                <th scope="col" className="py-2">
                  <span className="sr-only">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((load) => (
                <tr
                  key={load.collectionLoadId}
                  className="border-b border-slate-200 dark:border-slate-800"
                >
                  <td className="py-2 pr-4">
                    <Link
                      className="underline underline-offset-4"
                      to={`/cargas/${load.collectionLoadId}`}
                    >
                      {load.title}
                    </Link>
                  </td>
                  <td className="py-2 pr-4">
                    <StatusBadge status={load.status} />
                  </td>
                  <td className="py-2 pr-4 text-right tabular-nums">
                    {load.counters.rowsRead}
                  </td>
                  <td className="py-2 pr-4 text-right tabular-nums">
                    {load.counters.rowsImported}
                  </td>
                  <td className="py-2 pr-4 text-right tabular-nums">
                    {load.counters.rowsFlagged}
                  </td>
                  <td className="py-2 pr-4 text-right tabular-nums">
                    {load.counters.rowsRejected}
                  </td>
                  <td className="py-2 pr-4 whitespace-nowrap">
                    {new Date(load.createdAt).toLocaleString('es-CR')}
                  </td>
                  <td className="py-2">
                    {confirming === load.collectionLoadId ? (
                      <DeleteConfirmation
                        load={load}
                        busy={busy === load.collectionLoadId}
                        onConfirm={() => void handleDelete(load)}
                        onCancel={() => setConfirming(null)}
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setNotice(null);
                          setConfirming(load.collectionLoadId);
                        }}
                        className="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
                      >
                        Eliminar
                        <span className="sr-only"> la carga {load.title}</span>
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/**
 * Confirmación previa a una operación no reversible (FR-002).
 *
 * Indica cuántos registros se pierden y toma el foco al aparecer, para que quien
 * navega con teclado no tenga que buscarla.
 */
function DeleteConfirmation({
  load,
  busy,
  onConfirm,
  onCancel,
}: {
  load: ResumenDeCarga;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancelRef.current?.focus();
  }, []);

  return (
    <div
      role="group"
      aria-label={`Confirmar la eliminación de ${load.title}`}
      className="flex items-center gap-2 whitespace-nowrap"
    >
      <span className="text-xs text-red-800 dark:text-red-300">
        ¿Eliminar {load.counters.rowsImported} registros? No se puede deshacer.
      </span>
      <button
        type="button"
        onClick={onConfirm}
        disabled={busy}
        className="rounded bg-red-700 px-2 py-1 text-xs font-medium text-white hover:bg-red-800 disabled:opacity-60"
      >
        {busy ? 'Eliminando…' : 'Sí, eliminar'}
      </button>
      <button
        ref={cancelRef}
        type="button"
        onClick={onCancel}
        disabled={busy}
        className="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
      >
        Cancelar
      </button>
    </div>
  );
}
