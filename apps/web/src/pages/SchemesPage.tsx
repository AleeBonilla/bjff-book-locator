import type { Scheme, SchemeUnavailableReason } from '@bjff/api-types';
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
      .catch(() => setError('No se pudieron cargar los esquemas.'));
  }, []);

  async function create(event: FormEvent): Promise<void> {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const scheme = await api.createScheme({ name, description: description || null });
      navigate(`/esquemas/schemes/${scheme.schemeId}`);
    } catch (cause) {
      setError(
        cause instanceof ApiRequestError ? cause.message : 'No se pudo crear el esquema.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function copy(scheme: Scheme): Promise<void> {
    const name = window.prompt('Nombre del nuevo esquema', `${scheme.name} (copia)`);
    if (!name?.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const created = await api.copyScheme(scheme.schemeId, { name: name.trim() });
      navigate(`/esquemas/schemes/${created.schemeId}`);
    } catch (cause) {
      setError(
        cause instanceof ApiRequestError
          ? cause.message
          : 'No se pudo copiar el esquema.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="schemes-title">
      <h2 id="schemes-title" className="text-2xl font-semibold text-[#002855]">
        Esquemas físicos
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        Representan las ubicaciones reales y pueden combinar distintas plantillas.
      </p>
      <p role="alert" className="mt-3 min-h-5 text-sm text-red-700">
        {error}
      </p>
      <form
        onSubmit={(event) => void create(event)}
        className="surface my-5 grid max-w-2xl gap-4 p-5"
      >
        <h3 className="font-semibold">Nuevo esquema</h3>
        <label className="grid gap-1 text-sm">
          Nombre
          <input
            required
            maxLength={60}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <label className="grid gap-1 text-sm">
          Descripción opcional
          <input
            maxLength={255}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </label>
        <button disabled={busy} className="button-primary w-fit">
          {busy ? 'Creando…' : 'Crear esquema'}
        </button>
      </form>
      {!items ? (
        <p role="status">Cargando…</p>
      ) : items.length === 0 ? (
        <p>No hay esquemas todavía.</p>
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
                    <Link
                      className="underline"
                      to={`/esquemas/schemes/${scheme.schemeId}`}
                    >
                      {scheme.name}
                    </Link>
                  </td>
                  <td>{scheme.status === 'DRAFT' ? 'Borrador' : 'Definido'}</td>
                  <td>{scheme.enabled ? 'Habilitado' : 'Deshabilitado'}</td>
                  <td>
                    {scheme.availableForNewRun
                      ? 'Disponible'
                      : scheme.unavailableReasons.map(availabilityReason).join(', ')}
                  </td>
                  <td>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void copy(scheme)}
                      className="button-quiet min-h-0 px-3 py-1 text-xs"
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

function availabilityReason(reason: SchemeUnavailableReason): string {
  const labels: Record<SchemeUnavailableReason, string> = {
    SCHEME_DISABLED: 'Esquema deshabilitado',
    SCHEME_NOT_DEFINED: 'Falta definirlo',
    TEMPLATE_DISABLED: 'Usa una plantilla deshabilitada',
    NO_USABLE_POSITIONS: 'No tiene posiciones utilizables',
  };
  return labels[reason];
}
