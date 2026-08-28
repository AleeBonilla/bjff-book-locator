import { useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';

import { useAdmin } from '../AdminContext';
import { Modal } from '../components/Common';
import type { SchemeWorkspaceContext } from '../components/WorkflowLayout';
import { statusLabel } from '../types';

export function DangerZoneScreen() {
  const { scheme } = useOutletContext<SchemeWorkspaceContext>();
  const { gateway, commit } = useAdmin();
  const navigate = useNavigate();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const currentState = scheme.isActive
    ? 'Activo'
    : scheme.publishedAt
      ? 'Publicado'
      : statusLabel(scheme.status);
  const mapCount = scheme.topMaps.length + scheme.frontLayers.length;

  async function remove() {
    try {
      await commit(gateway.deleteScheme(scheme.id), 'Esquema eliminado.');
      navigate('/admin', { replace: true });
    } catch {
      // El gateway ya presentó el error funcional.
    }
  }

  return (
    <section className="admin-stage" aria-labelledby="danger-zone-title">
      <div className="admin-stage-heading admin-stage-heading--danger">
        <div className="admin-danger-heading">
          <div className="admin-danger-title-line">
            <h2 id="danger-zone-title">Zona de riesgo</h2>
            <span className="admin-danger-icon" aria-hidden="true">!</span>
          </div>
          <p>Las acciones de esta etapa son permanentes.</p>
        </div>
      </div>

      <section className="admin-danger-zone" aria-labelledby="delete-scheme-title">
        <div className="admin-danger-zone__header">
          <div>
            <h3 id="delete-scheme-title">Eliminar esquema</h3>
            <p>{scheme.name}</p>
          </div>
          <span className="admin-danger-state">Estado: {currentState}</span>
        </div>

        <div className="admin-danger-impact-grid">
          <section className="admin-danger-impact" aria-labelledby="affected-content-title">
            <h4 id="affected-content-title">Contenido que se eliminará</h4>
            <dl>
              <div><dt>Niveles</dt><dd>{scheme.levels.length}</dd></div>
              <div><dt>Ubicaciones</dt><dd>{scheme.locations.length}</dd></div>
              <div><dt>Rangos</dt><dd>{scheme.ranges.length}</dd></div>
              <div><dt>Mapas</dt><dd>{mapCount}</dd></div>
            </dl>
          </section>

          <section className="admin-danger-outcome" aria-labelledby="delete-outcome-title">
            <h4 id="delete-outcome-title">Qué ocurrirá al eliminarlo</h4>
            <ul>
              <li>Se borrarán también sus asignaciones y relaciones internas.</li>
              <li>No será posible recuperar el esquema ni su configuración.</li>
              {scheme.isActive ? <li>La búsqueda pública quedará sin un esquema activo.</li> : null}
              {!scheme.isActive && scheme.publishedAt ? <li>La versión publicada dejará de estar disponible.</li> : null}
            </ul>
          </section>
        </div>

        <div className="admin-danger-zone__actions">
          <button className="admin-button admin-button--danger" type="button" onClick={() => setConfirmDelete(true)}>Eliminar esquema</button>
        </div>
      </section>

      {confirmDelete ? (
        <Modal title="Confirmar eliminación" onClose={() => setConfirmDelete(false)}>
          <p>Vas a eliminar <strong>{scheme.name}</strong> en estado <strong>{currentState}</strong>. Esta acción no se puede deshacer.</p>
          {scheme.isActive ? <p className="admin-delete-warning">La búsqueda pública quedará sin un esquema activo.</p> : null}
          {!scheme.isActive && scheme.publishedAt ? <p className="admin-delete-warning">La versión publicada dejará de estar disponible.</p> : null}
          <div className="admin-form-actions">
            <button className="admin-button admin-button--danger" type="button" onClick={() => void remove()}>Eliminar definitivamente</button>
            <button className="admin-button admin-button--quiet" type="button" onClick={() => setConfirmDelete(false)}>Cancelar</button>
          </div>
        </Modal>
      ) : null}
    </section>
  );
}
