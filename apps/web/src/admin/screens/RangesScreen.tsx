import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';

import { useAdmin } from '../AdminContext';
import type { SchemeWorkspaceContext } from '../components/WorkflowLayout';
import { locationRoute, terminalLocations } from '../types';

type RangeDrafts = Record<string, { rangeStart: string; rangeEnd: string }>;

export function RangesScreen() {
  const { scheme } = useOutletContext<SchemeWorkspaceContext>();
  const { gateway, commit } = useAdmin();
  const terminals = useMemo(() => terminalLocations(scheme), [scheme]);
  const [view, setView] = useState<'focused' | 'table'>('focused');
  const [selectedId, setSelectedId] = useState(terminals[0]?.id ?? '');
  const [drafts, setDrafts] = useState<RangeDrafts>({});
  const editable = !scheme.publishedAt;

  useEffect(() => {
    setDrafts(Object.fromEntries(terminals.map((location) => {
      const range = scheme.ranges.find((item) => item.locationId === location.id);
      return [location.id, { rangeStart: range?.rangeStart ?? '', rangeEnd: range?.rangeEnd ?? '' }];
    })));
    setSelectedId((current) => terminals.some((location) => location.id === current) ? current : terminals[0]?.id ?? '');
  }, [scheme.ranges, terminals]);

  const selected = terminals.find((location) => location.id === selectedId) ?? null;
  const completed = terminals.filter((location) => scheme.ranges.some((range) => range.locationId === location.id)).length;

  function updateDraft(locationId: string, field: 'rangeStart' | 'rangeEnd', value: string) {
    setDrafts((current) => ({
      ...current,
      [locationId]: { ...(current[locationId] ?? { rangeStart: '', rangeEnd: '' }), [field]: value },
    }));
  }

  async function saveSelected(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const data = new FormData(event.currentTarget);
    try {
      await commit(gateway.saveRange(scheme.id, {
        locationId: selected.id,
        rangeStart: String(data.get('rangeStart') ?? ''),
        rangeEnd: String(data.get('rangeEnd') ?? ''),
      }), 'Rango guardado.');
      const currentIndex = terminals.findIndex((location) => location.id === selected.id);
      setSelectedId(terminals[currentIndex + 1]?.id ?? selected.id);
    } catch {
      // El gateway ya presentó el error funcional.
    }
  }

  async function saveTable() {
    const items = terminals.flatMap((location) => {
      const draft = drafts[location.id];
      if (!draft?.rangeStart && !draft?.rangeEnd) return [];
      return [{ locationId: location.id, ...draft }];
    });
    try {
      await commit(gateway.saveRanges(scheme.id, items), 'Rangos guardados.');
    } catch {
      // El gateway ya presentó el error funcional.
    }
  }

  async function clearSelected() {
    if (!selected) return;
    try {
      await commit(gateway.deleteRange(scheme.id, selected.id), 'Rango retirado.');
    } catch {
      // El gateway ya presentó el error funcional.
    }
  }

  return (
    <section className="admin-stage" aria-labelledby="ranges-title">
      <div className="admin-stage-heading">
        <div><h2 id="ranges-title">Asignar rangos</h2><p>Los rangos solapados están permitidos.</p></div>
        <span className={`admin-readiness ${completed === terminals.length && terminals.length ? 'is-ready' : ''}`}>{completed} de {terminals.length}</span>
      </div>

      <div className="admin-tabs" role="tablist" aria-label="Formas de capturar rangos">
        <button type="button" role="tab" aria-selected={view === 'focused'} className={view === 'focused' ? 'is-active' : ''} onClick={() => setView('focused')}>Captura enfocada</button>
        <button type="button" role="tab" aria-selected={view === 'table'} className={view === 'table' ? 'is-active' : ''} onClick={() => setView('table')}>Tabla completa</button>
      </div>

      {view === 'focused' ? (
        <div className="admin-range-layout">
          <div className="admin-card admin-range-list">
            {terminals.map((location) => {
              const range = scheme.ranges.find((item) => item.locationId === location.id);
              return (
                <button className={location.id === selectedId ? 'is-selected' : ''} key={location.id} type="button" onClick={() => setSelectedId(location.id)}>
                  <span><strong>{location.name}</strong><small>{location.code}</small></span>
                  <span className={range ? 'is-complete' : ''}>{range ? 'Definido' : 'Pendiente'}</span>
                </button>
              );
            })}
          </div>

          {selected ? (
            <form className="admin-card admin-form admin-range-editor" onSubmit={(event) => void saveSelected(event)}>
              <div className="admin-card-heading"><div><h3>{selected.name}</h3><span>{selected.code}</span></div></div>
              <div className="admin-field"><label htmlFor="range-start">Inicio</label><input id="range-start" name="rangeStart" value={drafts[selected.id]?.rangeStart ?? ''} onChange={(event) => updateDraft(selected.id, 'rangeStart', event.target.value)} placeholder="Ej. 500 A" disabled={!editable} required /></div>
              <div className="admin-field"><label htmlFor="range-end">Final</label><input id="range-end" name="rangeEnd" value={drafts[selected.id]?.rangeEnd ?? ''} onChange={(event) => updateDraft(selected.id, 'rangeEnd', event.target.value)} placeholder="Ej. 519.9 Z" disabled={!editable} required /></div>
              <div className="admin-derived-coverage"><strong>Cobertura calculada</strong><span>{locationRoute(scheme, selected).slice(0, -1).map((location) => location.name).join(', ') || 'Sin niveles superiores'}</span></div>
              {editable ? <div className="admin-form-actions"><button className="admin-button" type="submit">Guardar y continuar</button><button className="admin-button admin-button--danger" type="button" onClick={() => void clearSelected()}>Quitar rango</button></div> : null}
            </form>
          ) : <div className="admin-empty">No hay ubicaciones de captura.</div>}
        </div>
      ) : (
        <div className="admin-card admin-table-scroll">
          <table className="admin-table admin-range-table">
            <thead><tr><th>Ubicación</th><th>Código</th><th>Inicio</th><th>Final</th><th>Estado</th></tr></thead>
            <tbody>
              {terminals.map((location) => {
                const current = drafts[location.id] ?? { rangeStart: '', rangeEnd: '' };
                const complete = Boolean(current.rangeStart && current.rangeEnd);
                return (
                  <tr key={location.id}>
                    <td><strong>{location.name}</strong></td>
                    <td><code>{location.code}</code></td>
                    <td><input aria-label={`Inicio de ${location.name}`} value={current.rangeStart} onChange={(event) => updateDraft(location.id, 'rangeStart', event.target.value)} disabled={!editable} /></td>
                    <td><input aria-label={`Final de ${location.name}`} value={current.rangeEnd} onChange={(event) => updateDraft(location.id, 'rangeEnd', event.target.value)} disabled={!editable} /></td>
                    <td><span className={`admin-status ${complete ? 'admin-status--assigned' : 'admin-status--draft'}`}>{complete ? 'Definido' : 'Pendiente'}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {editable ? <div className="admin-table-footer"><button className="admin-button" type="button" onClick={() => void saveTable()}>Guardar tabla</button></div> : null}
        </div>
      )}

      {completed === terminals.length && terminals.length ? <div className="admin-post-actions"><span>Todos los rangos están definidos.</span><Link className="admin-button" to="../review">Revisar esquema</Link></div> : null}
    </section>
  );
}
