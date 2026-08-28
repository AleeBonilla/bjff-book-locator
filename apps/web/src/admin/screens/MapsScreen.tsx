import { type FormEvent, useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';

import { errorMessage, useAdmin } from '../AdminContext';
import type { SchemeWorkspaceContext } from '../components/WorkflowLayout';
import { svgDataUrl } from '../svg';
import { terminalLevel, type MapValidation } from '../types';

type MapTab = 'top' | 'front';

function pluralizeLevel(name: string) {
  const normalized = name.trim().toLocaleLowerCase('es');
  if (!normalized) return 'ubicaciones';
  if (normalized.endsWith('z')) return `${normalized.slice(0, -1)}ces`;
  if (/[aeiouáéíóú]$/.test(normalized)) return `${normalized}s`;
  return `${normalized}es`;
}

export function MapsScreen() {
  const { scheme } = useOutletContext<SchemeWorkspaceContext>();
  const { gateway, commit, notify, revision } = useAdmin();
  const [tab, setTab] = useState<MapTab>('top');
  const [validation, setValidation] = useState<MapValidation | null>(null);
  const [preview, setPreview] = useState<{ name: string; source: string } | null>(null);
  const [topSource, setTopSource] = useState('');
  const [topFileName, setTopFileName] = useState('');
  const [frontSource, setFrontSource] = useState('');
  const [frontFileName, setFrontFileName] = useState('');
  const editable = !scheme.publishedAt;
  const terminal = terminalLevel(scheme);
  const terminalIndex = terminal ? scheme.levels.findIndex((level) => level.id === terminal.id) : -1;
  const frontContextLevel = terminalIndex > 0 ? scheme.levels[terminalIndex - 1] : null;
  const terminalPlural = pluralizeLevel(terminal?.name ?? 'ubicación');

  useEffect(() => {
    let active = true;
    void gateway.validateMaps(scheme.id).then(({ data }) => {
      if (active) setValidation(data);
    });
    return () => {
      active = false;
    };
  }, [gateway, revision, scheme.id]);

  async function readSvg(file: File | undefined, target: 'top' | 'front') {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.svg')) {
      notify('Selecciona un archivo SVG.', 'error');
      return;
    }
    const source = await file.text();
    if (target === 'top') {
      setTopSource(source);
      setTopFileName(file.name);
    } else {
      setFrontSource(source);
      setFrontFileName(file.name);
    }
  }

  async function saveTop(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const representedLevelIds = data.getAll('representedLevelIds').map(String);
    try {
      await commit(gateway.saveTopMap(scheme.id, {
        name: String(data.get('name') ?? ''),
        svgName: topFileName,
        source: topSource,
        representedLevelIds,
      }), 'Mapa superior guardado.');
      event.currentTarget.reset();
      setTopSource('');
      setTopFileName('');
    } catch {
      // El gateway ya presentó el error funcional.
    }
  }

  async function saveFront(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const layerId = String(data.get('layerId') ?? '');
    const existingLayer = scheme.frontLayers.find((layer) => layer.id === layerId);
    try {
      await commit(gateway.saveFrontVariant(scheme.id, {
        ...(layerId ? { layerId } : {}),
        layerName: existingLayer?.name ?? String(data.get('layerName') ?? ''),
        representedLevelId: existingLayer?.representedLevelId ?? String(data.get('representedLevelId') ?? ''),
        variantName: String(data.get('variantName') ?? ''),
        variantCode: String(data.get('variantCode') ?? ''),
        slotCount: Number(data.get('slotCount')),
        source: frontSource,
      }), 'Variante frontal guardada.');
      event.currentTarget.reset();
      setFrontSource('');
      setFrontFileName('');
    } catch {
      // El gateway ya presentó el error funcional.
    }
  }

  async function assign(layerId: string, locationId: string, variantId: string) {
    try {
      await commit(
        gateway.assignFrontVariant(scheme.id, layerId, locationId, variantId || null),
        'Asignación actualizada.',
      );
    } catch {
      // El gateway ya presentó el error funcional.
    }
  }

  async function validate() {
    try {
      const { data } = await gateway.validateMaps(scheme.id);
      setValidation(data);
      notify(data.ready ? 'La configuración de mapas está completa.' : 'La configuración todavía está incompleta.', data.ready ? 'success' : 'error');
    } catch (error) {
      notify(errorMessage(error), 'error');
    }
  }

  return (
    <section className="admin-stage" aria-labelledby="maps-title">
      <div className="admin-stage-heading">
        <div><h2 id="maps-title">Configurar mapas</h2><p>La vista superior es obligatoria; la frontal es opcional.</p></div>
        <span className={`admin-readiness ${validation?.ready ? 'is-ready' : ''}`}>{validation?.ready ? 'Completo' : `${validation?.missingTopLocationIds.length ?? 0} sin cobertura`}</span>
      </div>

      <div className="admin-tabs" role="tablist" aria-label="Tipos de mapa">
        <button type="button" role="tab" aria-selected={tab === 'top'} className={tab === 'top' ? 'is-active' : ''} onClick={() => setTab('top')}>Vista superior</button>
        <button type="button" role="tab" aria-selected={tab === 'front'} className={tab === 'front' ? 'is-active' : ''} onClick={() => setTab('front')}>Vista frontal</button>
      </div>

      {tab === 'top' ? (
        <div className="admin-map-layout">
          {editable ? (
            <form className="admin-card admin-form admin-map-form" onSubmit={(event) => void saveTop(event)}>
              <div className="admin-field"><label htmlFor="top-map-name">Nombre</label><input id="top-map-name" name="name" placeholder="Plano principal" required /></div>
              <fieldset className="admin-check-list">
                <legend>Niveles representados</legend>
                {scheme.levels.map((level) => <label key={level.id}><input type="checkbox" name="representedLevelIds" value={level.id} />{level.name}</label>)}
              </fieldset>
              <label className="admin-file-field">
                <span>Archivo SVG</span>
                <input type="file" accept=".svg,image/svg+xml" onChange={(event) => void readSvg(event.target.files?.[0], 'top')} required />
                <small>{topFileName || 'Selecciona el plano superior.'}</small>
              </label>
              <button className="admin-button" type="submit" disabled={!topSource}>Guardar mapa</button>
            </form>
          ) : null}

          <div className="admin-map-list">
            {scheme.topMaps.map((map) => (
              <article className="admin-card admin-map-item" key={map.id}>
                <div><strong>{map.name}</strong><span>{map.svgName}</span></div>
                <div className="admin-map-item__actions">
                  <button className="admin-button admin-button--quiet admin-button--compact" type="button" onClick={() => setPreview({ name: map.name, source: map.source })}>Ver mapa</button>
                  {editable ? <button className="admin-button admin-button--danger admin-button--compact" type="button" onClick={() => void commit(gateway.deleteTopMap(scheme.id, map.id), 'Mapa eliminado.').catch(() => undefined)}>Eliminar</button> : null}
                </div>
              </article>
            ))}
            {!scheme.topMaps.length ? <div className="admin-empty">No hay mapas superiores.</div> : null}
          </div>
        </div>
      ) : (
        <div className="admin-map-layout">
          {editable ? (
            <form className="admin-card admin-form admin-map-form" onSubmit={(event) => void saveFront(event)}>
              <div className="admin-field"><label htmlFor="front-layer">Capa</label><select id="front-layer" name="layerId"><option value="">Nueva capa</option>{scheme.frontLayers.map((layer) => <option key={layer.id} value={layer.id}>{layer.name}</option>)}</select></div>
              <div className="admin-field"><label htmlFor="front-layer-name">Nombre de capa nueva</label><input id="front-layer-name" name="layerName" placeholder="Muebles estándar" /></div>
              <div className="admin-field"><label htmlFor="front-level">Se asigna a cada</label><output className="admin-derived-value" id="front-level">{frontContextLevel?.name ?? 'No disponible'}</output><input name="representedLevelId" type="hidden" value={frontContextLevel?.id ?? ''} /></div>
              <div className="admin-form-grid"><div className="admin-field"><label htmlFor="variant-name">Variante</label><input id="variant-name" name="variantName" placeholder={`Ej. 5 ${terminalPlural}`} required /></div><div className="admin-field"><label htmlFor="variant-code">Código</label><input id="variant-code" name="variantCode" placeholder="variante-5" required /></div></div>
              <div className="admin-field"><label htmlFor="slot-count">Cantidad de {terminalPlural}</label><input id="slot-count" name="slotCount" type="number" min="1" max="50" defaultValue="5" required /></div>
              <label className="admin-file-field"><span>Archivo SVG</span><input type="file" accept=".svg,image/svg+xml" onChange={(event) => void readSvg(event.target.files?.[0], 'front')} required /><small>{frontFileName || 'Selecciona la vista frontal.'}</small></label>
              <button className="admin-button" type="submit" disabled={!frontSource || !frontContextLevel}>Guardar variante</button>
            </form>
          ) : null}

          <div className="admin-map-list">
            {scheme.frontLayers.map((layer) => {
              const contexts = scheme.locations.filter((location) => location.levelId === layer.representedLevelId);
              return (
                <article className="admin-card admin-front-layer" key={layer.id}>
                  <div className="admin-card-heading"><div><strong>{layer.name}</strong><span>{layer.variants.length} {layer.variants.length === 1 ? 'variante' : 'variantes'}</span></div>{editable ? <button className="admin-button admin-button--danger admin-button--compact" type="button" onClick={() => void commit(gateway.deleteFrontLayer(scheme.id, layer.id), 'Capa eliminada.').catch(() => undefined)}>Eliminar</button> : null}</div>
                  <div className="admin-variant-list">{layer.variants.map((variant) => <button key={variant.id} type="button" onClick={() => setPreview({ name: variant.name, source: variant.source })}><strong>{variant.name}</strong><span>{variant.slotCount} {terminalPlural}</span></button>)}</div>
                  <div className="admin-assignment-list">
                    {contexts.map((location) => {
                      const assignedId = layer.assignments[location.id] ?? '';
                      const assigned = layer.variants.find((variant) => variant.id === assignedId);
                      return (
                        <div className="admin-assignment-row" key={location.id}>
                          <span>{location.name}<small>{location.code}</small></span>
                          {editable ? (
                            <select aria-label={`Variante para ${location.name}`} value={assignedId} onChange={(event) => void assign(layer.id, location.id, event.target.value)}><option value="">Sin asignar</option>{layer.variants.map((variant) => <option key={variant.id} value={variant.id}>{variant.name}</option>)}</select>
                          ) : (
                            <details className="admin-readonly-select">
                              <summary>{assigned?.name ?? 'Sin asignar'}</summary>
                              <ul>{layer.variants.map((variant) => <li className={variant.id === assignedId ? 'is-current' : ''} key={variant.id}>{variant.name}</li>)}</ul>
                            </details>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </article>
              );
            })}
            {!scheme.frontLayers.length ? <div className="admin-empty">No hay capas frontales. Puedes omitirlas.</div> : null}
          </div>
        </div>
      )}

      {preview ? (
        <section className="admin-map-preview" aria-labelledby="map-preview-title">
          <div className="admin-card-heading"><h3 id="map-preview-title">{preview.name}</h3><button className="admin-button admin-button--quiet admin-button--compact" type="button" onClick={() => setPreview(null)}>Cerrar</button></div>
          <div className="admin-map-canvas"><img src={svgDataUrl(preview.source)} alt={`Vista previa de ${preview.name}`} /></div>
        </section>
      ) : null}

      {validation?.frontWarnings.length ? <ul className="admin-warning-list">{validation.frontWarnings.map((warning) => <li key={warning}>{warning}</li>)}</ul> : null}
      <div className="admin-form-actions admin-form-actions--end"><button className="admin-button" type="button" onClick={() => void validate()}>Validar mapas</button></div>
    </section>
  );
}
