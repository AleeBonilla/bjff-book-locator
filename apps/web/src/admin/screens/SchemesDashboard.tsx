import { type FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { useAdmin } from '../AdminContext';
import { type CloneScope, type Scheme, statusLabel } from '../types';
import { EmptyState, Modal, PageLoading } from '../components/Common';

function destinationFor(scheme: Scheme) {
  if (scheme.status === 'DRAFT') return `/admin/schemes/${scheme.id}/levels`;
  if (scheme.status === 'LEVELS_DEFINED') return `/admin/schemes/${scheme.id}/locations`;
  if (scheme.status === 'LOCATIONS_DEFINED' || scheme.status === 'PARTIALLY_ASSIGNED') {
    return `/admin/schemes/${scheme.id}/ranges`;
  }
  return `/admin/schemes/${scheme.id}/review`;
}

function SchemeTable({
  schemes,
  actionLabel,
  onClone,
}: {
  schemes: Scheme[];
  actionLabel: string;
  onClone: (scheme: Scheme) => void;
}) {
  if (!schemes.length) return <EmptyState>No hay esquemas en esta categoría.</EmptyState>;

  return (
    <div className="admin-table-scroll">
      <table className="admin-table">
        <thead>
          <tr><th>Esquema</th><th>Estado</th><th>Actualización</th><th>Acciones</th></tr>
        </thead>
        <tbody>
          {schemes.map((scheme) => (
            <tr key={scheme.id}>
              <td><strong>{scheme.name}</strong><span>{scheme.shortDescription || `Esquema ${scheme.id}`}</span></td>
              <td><span className={`admin-status admin-status--${scheme.status.toLowerCase()}`}>{statusLabel(scheme.status)}</span></td>
              <td className="is-centered">{new Intl.DateTimeFormat('es-CR', { dateStyle: 'medium' }).format(new Date(scheme.updatedAt))}</td>
              <td>
                <div className="admin-table-actions">
                  <Link className="admin-button admin-button--compact" to={destinationFor(scheme)}>{actionLabel}</Link>
                  <button className="admin-button admin-button--quiet admin-button--compact" type="button" onClick={() => onClone(scheme)}>Clonar</button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SchemesDashboard() {
  const { schemes, loading, gateway, commit } = useAdmin();
  const navigate = useNavigate();
  const [cloneSource, setCloneSource] = useState<Scheme | null>(null);

  if (loading) return <PageLoading label="Cargando esquemas…" />;

  const active = schemes.filter((scheme) => scheme.isActive);
  const ready = schemes.filter((scheme) => !scheme.isActive && !scheme.publishedAt && scheme.status === 'ASSIGNED');
  const drafts = schemes.filter((scheme) => !scheme.isActive && scheme.status !== 'ASSIGNED');

  async function handleClone(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!cloneSource) return;
    const data = new FormData(event.currentTarget);
    const name = String(data.get('name') ?? '');
    const scope = String(data.get('scope') ?? 'levels') as CloneScope;
    try {
      const clone = await commit(
        gateway.cloneScheme(cloneSource.id, { name, scope }),
        'Copia creada.',
      );
      setCloneSource(null);
      navigate(destinationFor(clone));
    } catch {
      // El gateway ya presentó el error funcional.
    }
  }

  return (
    <div className="admin-content">
      <header className="admin-page-heading">
        <div><h1>Esquemas</h1></div>
        <Link className="admin-button" to="/admin/schemes/new">Crear esquema</Link>
      </header>

      <section className="admin-scheme-group" aria-labelledby="active-schemes">
        <h2 id="active-schemes">Esquema activo</h2>
        <SchemeTable schemes={active} actionLabel="Ver" onClone={setCloneSource} />
      </section>

      <section className="admin-scheme-group" aria-labelledby="ready-schemes">
        <h2 id="ready-schemes">Listos para publicar</h2>
        <SchemeTable schemes={ready} actionLabel="Revisar" onClone={setCloneSource} />
      </section>

      <section className="admin-scheme-group" aria-labelledby="draft-schemes">
        <h2 id="draft-schemes">Borradores</h2>
        <SchemeTable schemes={drafts} actionLabel="Continuar" onClone={setCloneSource} />
      </section>

      {cloneSource ? (
        <Modal title="Clonar esquema" onClose={() => setCloneSource(null)}>
          <form className="admin-form" onSubmit={handleClone}>
            <label htmlFor="clone-name">Nombre de la copia</label>
            <input id="clone-name" name="name" defaultValue={`${cloneSource.name} - copia`} required />
            <fieldset className="admin-choice-list">
              <legend>Contenido</legend>
              <label><input type="radio" name="scope" value="levels" defaultChecked /><span><strong>Solo niveles</strong><small>Copia la estructura física.</small></span></label>
              <label><input type="radio" name="scope" value="levels_and_locations" /><span><strong>Niveles y ubicaciones</strong><small>Regenera los códigos con el nuevo esquema.</small></span></label>
              <label><input type="radio" name="scope" value="all" /><span><strong>Todo</strong><small>Copia rangos, mapas y asignaciones.</small></span></label>
            </fieldset>
            <div className="admin-form-actions">
              <button className="admin-button" type="submit">Crear copia</button>
              <button className="admin-button admin-button--quiet" type="button" onClick={() => setCloneSource(null)}>Cancelar</button>
            </div>
          </form>
        </Modal>
      ) : null}
    </div>
  );
}
