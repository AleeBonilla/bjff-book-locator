import type { Carga } from '@bjff/api-types';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';

import { ApiRequestError, api } from '../api/client.js';
import { Counters, StatusBadge } from '../components/Counters.js';

export function ImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [result, setResult] = useState<Carga | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (!file) return;

    setError(null);
    setResult(null);
    setBusy(true);
    try {
      setResult(await api.importCollection(file, title.trim()));
    } catch (cause) {
      // SC-010: el motivo debe entenderse sin abrir el archivo.
      setError(
        cause instanceof ApiRequestError
          ? cause.message
          : 'No se pudo importar el archivo.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <h2 className="mb-6 text-xl font-semibold">Importar una colección</h2>

      <form onSubmit={handleSubmit} className="flex max-w-lg flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="title" className="text-sm font-medium">
            Título de la carga <span className="text-slate-500">(opcional)</span>
          </label>
          <input
            id="title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="rounded border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="file" className="text-sm font-medium">
            Archivo CSV de la colección
          </label>
          <input
            id="file"
            type="file"
            accept=".csv,text/csv"
            required
            aria-describedby="file-ayuda"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            className="rounded border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
          />
          <p id="file-ayuda" className="text-xs text-slate-600 dark:text-slate-400">
            UTF-8, separado por punto y coma, con las columnas codBarras y Clasificacion.
          </p>
        </div>

        <p role="alert" aria-live="assertive" className="min-h-5 text-sm text-red-700 dark:text-red-400">
          {error}
        </p>

        <button
          type="submit"
          disabled={busy || !file}
          className="self-start rounded bg-sky-700 px-4 py-2 font-medium text-white hover:bg-sky-800 disabled:opacity-60"
        >
          {busy ? 'Importando…' : 'Importar'}
        </button>
      </form>

      {result && (
        <div className="mt-8" role="status" aria-live="polite">
          <div className="mb-3 flex items-center gap-3">
            <h3 className="text-lg font-semibold">Resultado</h3>
            <StatusBadge status={result.status} />
          </div>

          {result.errorMessage && (
            <p className="mb-4 text-sm text-red-700 dark:text-red-400">
              {result.errorMessage} Ningún registro de esta carga queda disponible.
            </p>
          )}

          <Counters counters={result.counters} />

          <p className="mt-4 text-sm">
            <Link
              className="underline underline-offset-4"
              to={`/cargas/${result.collectionLoadId}`}
            >
              Ver el detalle y los problemas de la carga
            </Link>
          </p>
        </div>
      )}
    </section>
  );
}
