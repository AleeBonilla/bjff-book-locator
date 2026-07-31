import type { Scheme } from '@bjff/api-types';
import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { ApiRequestError, api } from '../api/client.js';

export function SchemesPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<Scheme[] | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .schemes()
      .then((page) => setItems(page.items))
      .catch(() => setError('No se pudieron cargar los schemes.'));
  }, []);

  async function create(event: FormEvent): Promise<void> {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const scheme = await api.createScheme({ name, description: description || null });
      navigate(`/schemes/${scheme.schemeId}`);
    } catch (cause) {
      setError(
        cause instanceof ApiRequestError ? cause.message : 'No se pudo crear el scheme.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function copy(scheme: Scheme): Promise<void> {
    const name = window.prompt('Nombre del nuevo scheme', `${scheme.name} — copia`);
    if (!name?.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const created = await api.copyScheme(scheme.schemeId, { name: name.trim() });
      navigate(`/schemes/${created.schemeId}`);
    } catch (cause) {
      setError(
        cause instanceof ApiRequestError ? cause.message : 'No se pudo copiar el scheme.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <h2 className="text-xl font-semibold">Schemes</h2>
      <p className="mt-1 text-sm text-slate-600">
        Versiones concretas de la estructura física.
      </p>
      <p role="alert" className="mt-3 min-h-5 text-sm text-red-700">
        {error}
      </p>
      <form
        onSubmit={(event) => void create(event)}
        className="my-5 grid gap-3 rounded border p-4"
      >
        <h3 className="font-semibold">Nuevo scheme</h3>
        <label className="grid gap-1 text-sm">
          Nombre
          <input
            required
            maxLength={60}
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="rounded border px-3 py-2"
          />
        </label>
        <label className="grid gap-1 text-sm">
          Descripción opcional
          <input
            maxLength={255}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            className="rounded border px-3 py-2"
          />
        </label>
        <button disabled={busy} className="w-fit rounded bg-sky-700 px-4 py-2 text-white">
          {busy ? 'Creando…' : 'Crear scheme'}
        </button>
      </form>
      {!items ? (
        <p role="status">Cargando…</p>
      ) : items.length === 0 ? (
        <p>No hay schemes todavía.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="py-2">Nombre</th>
                <th>Estado</th>
                <th>Habilitación</th>
                <th>Disponibilidad</th>
                <th>
                  <span className="sr-only">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((scheme) => (
                <tr key={scheme.schemeId} className="border-b">
                  <td className="py-2">
                    <Link className="underline" to={`/schemes/${scheme.schemeId}`}>
                      {scheme.name}
                    </Link>
                  </td>
                  <td>{scheme.status}</td>
                  <td>{scheme.enabled ? 'Habilitado' : 'Deshabilitado'}</td>
                  <td>
                    {scheme.availableForNewRun
                      ? 'Disponible'
                      : scheme.unavailableReasons.join(', ')}
                  </td>
                  <td>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void copy(scheme)}
                      className="rounded border px-2 py-1 text-xs"
                    >
                      Copiar
                    </button>
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
