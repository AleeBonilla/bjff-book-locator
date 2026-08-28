import { type FormEvent, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';

import { errorMessage, useAdmin } from '../AdminContext';
import { Modal } from '../components/Common';
import type { SchemeWorkspaceContext } from '../components/WorkflowLayout';
import type { Location, Scheme } from '../types';

function LocationBranch({
  location,
  scheme,
  editable,
  onAdd,
  onDelete,
}: {
  location: Location;
  scheme: Scheme;
  editable: boolean;
  onAdd: (location: Location) => void;
  onDelete: (location: Location) => void;
}) {
  const levelIndex = scheme.levels.findIndex((level) => level.id === location.levelId);
  const childLevel = scheme.levels[levelIndex + 1];
  const children = scheme.locations
    .filter((candidate) => candidate.parentLocationId === location.id)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <li className="admin-location-node">
      <div className="admin-location-row">
        <div className="admin-location-copy">
          <strong>{location.name}</strong>
          <span>{location.code}</span>
        </div>
        {editable ? (
          <div className="admin-location-actions">
            {childLevel ? <button className="admin-add-child" type="button" onClick={() => onAdd(location)} aria-label={`Añadir ${childLevel.name} bajo ${location.name}`}>+ {childLevel.name}</button> : null}
            <button className="admin-icon-button admin-icon-button--danger" type="button" onClick={() => onDelete(location)} aria-label={`Eliminar ${location.name}`}>×</button>
          </div>
        ) : null}
      </div>
      {children.length ? (
        <ol className="admin-location-children">
          {children.map((child) => <LocationBranch key={child.id} location={child} scheme={scheme} editable={editable} onAdd={onAdd} onDelete={onDelete} />)}
        </ol>
      ) : null}
    </li>
  );
}

export function LocationsScreen() {
  const { scheme } = useOutletContext<SchemeWorkspaceContext>();
  const { gateway, commit, notify } = useAdmin();
  const [addParent, setAddParent] = useState<Location | 'root' | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Location | null>(null);
  const [reopen, setReopen] = useState(false);
  const [csvOpen, setCsvOpen] = useState(false);
  const [csvLevelId, setCsvLevelId] = useState('all');
  const editable = scheme.status === 'LEVELS_DEFINED' && !scheme.publishedAt;
  const roots = scheme.locations
    .filter((location) => location.parentLocationId === null)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const parentLevelIndex = addParent && addParent !== 'root'
    ? scheme.levels.findIndex((level) => level.id === addParent.levelId)
    : -1;
  const pendingLevel = scheme.levels[parentLevelIndex + 1];

  async function addLocations(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!addParent) return;
    const quantity = Number(new FormData(event.currentTarget).get('quantity'));
    try {
      await commit(gateway.addLocations(scheme.id, {
        parentLocationId: addParent === 'root' ? null : addParent.id,
        quantity,
        ...(pendingLevel ? { schemeLevelId: pendingLevel.id } : {}),
      }), `${quantity} ${quantity === 1 ? 'ubicación añadida' : 'ubicaciones añadidas'}.`);
      setAddParent(null);
    } catch {
      // El gateway ya presentó el error funcional.
    }
  }

  async function removeLocation() {
    if (!deleteTarget) return;
    try {
      await commit(gateway.deleteLocation(scheme.id, deleteTarget.id), 'Ubicación eliminada.');
      setDeleteTarget(null);
    } catch {
      // El gateway ya presentó el error funcional.
    }
  }

  async function confirmLocations() {
    try {
      await commit(gateway.confirmLocations(scheme.id), 'Ubicaciones confirmadas.');
    } catch {
      // El gateway ya presentó el error funcional.
    }
  }

  async function reopenLocations() {
    try {
      await commit(gateway.reopenLocations(scheme.id, true), 'Ubicaciones abiertas para edición.');
      setReopen(false);
    } catch {
      // El gateway ya presentó el error funcional.
    }
  }

  async function downloadCsv(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const selectedLevelId = csvLevelId === 'all' ? undefined : csvLevelId;
      const { data } = await gateway.exportLocationsCsv(scheme.id, selectedLevelId);
      const url = URL.createObjectURL(new Blob([data], { type: 'text/csv;charset=utf-8' }));
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = selectedLevelId === undefined
        ? `ubicaciones-${scheme.id}-completo.csv`
        : `ubicaciones-${scheme.id}-nivel-${selectedLevelId}.csv`;
      anchor.click();
      URL.revokeObjectURL(url);
      setCsvOpen(false);
    } catch (requestError) {
      notify(errorMessage(requestError), 'error');
    }
  }

  return (
    <section className="admin-stage" aria-labelledby="locations-title">
      <div className="admin-stage-heading">
        <div><h2 id="locations-title">Crear ubicaciones</h2><p>Añade cada rama siguiendo los niveles definidos.</p></div>
        <button className="admin-button admin-button--quiet" type="button" onClick={() => setCsvOpen(true)} disabled={!scheme.locations.length}>Generar CSV</button>
      </div>

      <div className="admin-card admin-location-card">
        {!roots.length ? (
          <div className="admin-empty"><span>Aún no hay ubicaciones.</span></div>
        ) : (
          <ol className="admin-location-tree">
            {roots.map((root) => <LocationBranch key={root.id} location={root} scheme={scheme} editable={editable} onAdd={setAddParent} onDelete={setDeleteTarget} />)}
          </ol>
        )}
      </div>

      {editable ? (
        <div className="admin-form-actions admin-form-actions--between">
          <button className="admin-button admin-button--quiet" type="button" onClick={() => setAddParent('root')}>Añadir {scheme.levels[0]?.name ?? 'raíz física'}</button>
          <button className="admin-button" type="button" onClick={() => void confirmLocations()} disabled={!scheme.locations.length}>Confirmar ubicaciones</button>
        </div>
      ) : (
        <div className="admin-completion-panel">
          <p className="admin-status-notice">Las ubicaciones están confirmadas.</p>
          <div className="admin-completion-actions">
            {!scheme.publishedAt ? <button className="admin-button admin-button--danger" type="button" onClick={() => setReopen(true)}>Editar ubicaciones</button> : null}
            <Link className="admin-button" to="../maps">Configurar mapas</Link>
            <Link className="admin-button admin-button--quiet" to="../ranges">Asignar rangos</Link>
          </div>
        </div>
      )}

      {addParent ? (
        <Modal title={`Añadir ${pendingLevel?.name ?? 'ubicaciones'}`} onClose={() => setAddParent(null)}>
          <form className="admin-form" onSubmit={(event) => void addLocations(event)}>
            <label htmlFor="location-quantity">Cantidad</label>
            <input id="location-quantity" name="quantity" type="number" min="1" max="50" defaultValue="1" required autoFocus />
            <div className="admin-form-actions">
              <button className="admin-button" type="submit">Añadir</button>
              <button className="admin-button admin-button--quiet" type="button" onClick={() => setAddParent(null)}>Cancelar</button>
            </div>
          </form>
        </Modal>
      ) : null}

      {csvOpen ? (
        <Modal title="Generar CSV" onClose={() => setCsvOpen(false)}>
          <form className="admin-form" onSubmit={(event) => void downloadCsv(event)}>
            <label htmlFor="csv-content">Ubicaciones incluidas</label>
            <select id="csv-content" value={csvLevelId} onChange={(event) => setCsvLevelId(event.target.value)} autoFocus>
              <option value="all">Todos los niveles, ordenados</option>
              {scheme.levels.map((level) => <option key={level.id} value={level.id}>Solo {level.name}</option>)}
            </select>
            <p className="admin-form-note">Incluye el código, la ruta completa y el código de la ubicación superior.</p>
            <div className="admin-form-actions">
              <button className="admin-button" type="submit">Descargar CSV</button>
              <button className="admin-button admin-button--quiet" type="button" onClick={() => setCsvOpen(false)}>Cancelar</button>
            </div>
          </form>
        </Modal>
      ) : null}

      {deleteTarget ? (
        <Modal title="Eliminar ubicación" onClose={() => setDeleteTarget(null)}>
          <p>Se eliminarán {deleteTarget.name} y todas sus ubicaciones inferiores.</p>
          <div className="admin-form-actions">
            <button className="admin-button admin-button--danger" type="button" onClick={() => void removeLocation()}>Eliminar</button>
            <button className="admin-button admin-button--quiet" type="button" onClick={() => setDeleteTarget(null)}>Cancelar</button>
          </div>
        </Modal>
      ) : null}

      {reopen ? (
        <Modal title="Editar ubicaciones" onClose={() => setReopen(false)}>
          <p>Se eliminarán los rangos y mapas configurados para este esquema.</p>
          <div className="admin-form-actions">
            <button className="admin-button admin-button--danger" type="button" onClick={() => void reopenLocations()}>Continuar</button>
            <button className="admin-button admin-button--quiet" type="button" onClick={() => setReopen(false)}>Cancelar</button>
          </div>
        </Modal>
      ) : null}
    </section>
  );
}
