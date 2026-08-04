import type { StructureTemplate } from '@bjff/api-types';
import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { ApiRequestError, api } from '../api/client.js';

export function TemplatesPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<StructureTemplate[] | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .templates()
      .then((page) => setItems(page.items))
      .catch(() => setError('No se pudieron cargar las plantillas.'));
  }, []);

  async function create(event: FormEvent): Promise<void> {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const template = await api.createTemplate({
        name,
        description: description || null,
      });
      navigate(`/plantillas/${template.structureTemplateId}`);
    } catch (cause) {
      setError(
        cause instanceof ApiRequestError
          ? cause.message
          : 'No se pudo crear la plantilla.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <h2 className="text-xl font-semibold">Plantillas de estructura</h2>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
        Definen formas reutilizables; no representan cantidades físicas.
      </p>
      <p role="alert" className="mt-3 min-h-5 text-sm text-red-700 dark:text-red-400">
        {error}
      </p>

      <form
        onSubmit={(event) => void create(event)}
        className="my-5 grid gap-3 rounded border border-slate-200 p-4 dark:border-slate-800"
      >
        <h3 className="font-semibold">Nueva plantilla</h3>
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
        <button
          disabled={busy}
          className="w-fit rounded bg-sky-700 px-4 py-2 font-medium text-white disabled:opacity-60"
        >
          {busy ? 'Creando…' : 'Crear plantilla'}
        </button>
      </form>

      {!items ? (
        <p role="status">Cargando…</p>
      ) : items.length === 0 ? (
        <p>No hay plantillas todavía.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="py-2">Nombre</th>
                <th>Estado</th>
                <th>Disponibilidad</th>
                <th>Actualizada</th>
              </tr>
            </thead>
            <tbody>
              {items.map((template) => (
                <tr
                  key={template.structureTemplateId}
                  className="border-b border-slate-200 dark:border-slate-800"
                >
                  <td className="py-2">
                    <Link
                      className="underline"
                      to={`/plantillas/${template.structureTemplateId}`}
                    >
                      {template.name}
                    </Link>
                  </td>
                  <td>{template.status}</td>
                  <td>{template.enabled ? 'Habilitada' : 'Deshabilitada'}</td>
                  <td>{new Date(template.updatedAt).toLocaleString('es-CR')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
