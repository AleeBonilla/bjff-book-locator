import { type FormEvent } from 'react';
import { Link, useNavigate, useOutletContext } from 'react-router-dom';

import { useAdmin } from '../AdminContext';
import type { SchemeWorkspaceContext } from '../components/WorkflowLayout';
import { WorkflowSteps } from '../components/WorkflowLayout';

function SchemeForm({
  initialName = '',
  initialDescription = '',
  submitLabel,
  onSubmit,
}: {
  initialName?: string;
  initialDescription?: string;
  submitLabel: string;
  onSubmit: (name: string, description: string) => Promise<void>;
}) {
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    await onSubmit(String(data.get('name') ?? ''), String(data.get('description') ?? ''));
  }

  return (
    <form className="admin-card admin-form admin-scheme-form" onSubmit={(event) => void handleSubmit(event)}>
      <div className="admin-field">
        <label htmlFor="scheme-name">Nombre del esquema</label>
        <input id="scheme-name" name="name" defaultValue={initialName} maxLength={120} required autoFocus />
      </div>
      <div className="admin-field">
        <label htmlFor="scheme-description">Descripción breve (opcional)</label>
        <textarea id="scheme-description" name="description" defaultValue={initialDescription} rows={3} maxLength={280} />
      </div>
      <div className="admin-form-actions">
        <button className="admin-button" type="submit">{submitLabel}</button>
        <Link className="admin-button admin-button--quiet" to="/admin">Cancelar</Link>
      </div>
    </form>
  );
}

export function NewSchemeScreen() {
  const { gateway, commit } = useAdmin();
  const navigate = useNavigate();

  async function create(name: string, shortDescription: string) {
    try {
      const scheme = await commit(gateway.createScheme({ name, shortDescription }), 'Esquema creado.');
      navigate(`/admin/schemes/${scheme.id}/levels`, { replace: true });
    } catch {
      // El gateway ya presentó el error funcional.
    }
  }

  return (
    <div className="admin-content admin-content--wide">
      <div className="admin-workspace-heading">
        <div><p className="admin-eyebrow">Nuevo esquema</p><h1>Crear esquema</h1></div>
        <Link className="admin-back" to="/admin">Volver a esquemas</Link>
      </div>
      <WorkflowSteps scheme={null} />
      <section className="admin-stage" aria-labelledby="new-scheme-title">
        <div className="admin-stage-heading"><div><h2 id="new-scheme-title">Datos del esquema</h2></div></div>
        <SchemeForm submitLabel="Guardar y definir niveles" onSubmit={create} />
      </section>
    </div>
  );
}

export function SchemeDetailsScreen() {
  const { scheme } = useOutletContext<SchemeWorkspaceContext>();
  const { gateway, commit } = useAdmin();

  async function update(name: string, shortDescription: string) {
    try {
      await commit(gateway.updateScheme(scheme.id, { name, shortDescription }), 'Datos guardados.');
    } catch {
      // El gateway ya presentó el error funcional.
    }
  }

  return (
    <section className="admin-stage" aria-labelledby="scheme-details-title">
      <div className="admin-stage-heading"><div><h2 id="scheme-details-title">Datos del esquema</h2></div></div>
      {scheme.publishedAt ? (
        <div className="admin-status-notice admin-status-notice--panel" role="status">
          <strong>Esquema publicado</strong>
          <span>No se pueden realizar cambios.</span>
        </div>
      ) : (
        <SchemeForm
          initialName={scheme.name}
          initialDescription={scheme.shortDescription}
          submitLabel="Guardar cambios"
          onSubmit={update}
        />
      )}

    </section>
  );
}
