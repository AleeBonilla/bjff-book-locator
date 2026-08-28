import { type FormEvent, useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';

import { errorMessage, useAdmin } from '../AdminContext';
import { Modal } from '../components/Common';
import type { SchemeWorkspaceContext } from '../components/WorkflowLayout';
import {
  terminalLevel,
  type FrontMapVariant,
  type MapValidation,
  type TopMap,
} from '../types';

type MapTab = 'top' | 'front';

interface SvgEditor {
  kind: 'top' | 'front';
  layerId: string;
  layerName: string;
  svgId: string;
  name: string;
  variantCode?: string;
  slotCount?: number;
}

function pluralizeLevel(name: string) {
  const normalized = name.trim().toLocaleLowerCase('es');
  if (!normalized) return 'ubicaciones';
  if (normalized.endsWith('z')) return `${normalized.slice(0, -1)}ces`;
  if (/[aeiouáéíóú]$/.test(normalized)) return `${normalized}s`;
  return `${normalized}es`;
}

function safeSvgFile(file: File | undefined) {
  return file && (file.name.toLowerCase().endsWith('.svg') || file.type === 'image/svg+xml') ? file : null;
}

export function MapsScreen() {
  const { scheme } = useOutletContext<SchemeWorkspaceContext>();
  const { gateway, commit, notify, revision, pending } = useAdmin();
  const [tab, setTab] = useState<MapTab>('top');
  const [validation, setValidation] = useState<MapValidation | null>(null);
  const [preview, setPreview] = useState<{ name: string; assetUrl: string } | null>(null);
  const [topFile, setTopFile] = useState<File | null>(null);
  const [variantFile, setVariantFile] = useState<File | null>(null);
  const [editor, setEditor] = useState<SvgEditor | null>(null);
  const [replacementFile, setReplacementFile] = useState<File | null>(null);
  const editable = !scheme.publishedAt;
  const terminal = terminalLevel(scheme);
  const terminalIndex = terminal ? scheme.levels.findIndex((level) => level.id === terminal.id) : -1;
  const contextLevel = terminalIndex > 0 ? scheme.levels[terminalIndex - 1] : null;
  const terminalPlural = pluralizeLevel(terminal?.name ?? 'ubicación');

  useEffect(() => {
    let active = true;
    void gateway.validateMaps(scheme.id).then(({ data }) => {
      if (active) setValidation(data);
    }).catch((requestError: unknown) => {
      if (active) notify(errorMessage(requestError), 'error');
    });
    return () => {
      active = false;
    };
  }, [gateway, notify, revision, scheme.id]);

  function chooseFile(file: File | undefined, target: 'top' | 'variant' | 'replacement') {
    const selected = safeSvgFile(file);
    if (file && !selected) notify('Selecciona un archivo SVG.', 'error');
    if (target === 'top') setTopFile(selected);
    if (target === 'variant') setVariantFile(selected);
    if (target === 'replacement') setReplacementFile(selected);
  }

  function reportUpload(removedItems: number, label: string) {
    notify(removedItems > 0 ? `${label} Se retiró contenido no permitido del SVG.` : label);
  }

  async function saveTop(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!topFile) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    try {
      const result = await commit(gateway.saveTopMap(scheme.id, {
        name: String(data.get('name') ?? ''),
        svgName: topFile.name,
        file: topFile,
        representedLevelIds: data.getAll('representedLevelIds').map(String),
      }));
      reportUpload(result.removedItems, 'Mapa superior guardado.');
      form.reset();
      setTopFile(null);
    } catch {
      // El contexto ya presentó el error.
    }
  }

  async function createFrontLayer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!terminal) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    try {
      await commit(gateway.createFrontLayer(scheme.id, {
        name: String(data.get('name') ?? ''),
        representedLevelId: terminal.id,
      }), 'Capa frontal creada.');
      form.reset();
    } catch {
      // El contexto ya presentó el error.
    }
  }

  async function saveVariant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!variantFile) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    try {
      const result = await commit(gateway.saveFrontVariant(scheme.id, {
        layerId: String(data.get('layerId') ?? ''),
        variantName: String(data.get('variantName') ?? ''),
        variantCode: String(data.get('variantCode') ?? ''),
        slotCount: Number(data.get('slotCount')),
        file: variantFile,
      }));
      reportUpload(result.removedItems, 'Variante guardada.');
      form.reset();
      setVariantFile(null);
    } catch {
      // El contexto ya presentó el error.
    }
  }

  async function replaceSvg(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editor) return;
    const data = new FormData(event.currentTarget);
    try {
      if (editor.kind === 'top' && String(data.get('layerName') ?? '') !== editor.layerName) {
        await commit(gateway.updateMapLayer(scheme.id, editor.layerId, {
          name: String(data.get('layerName') ?? ''),
        }));
      }
      const result = await commit(gateway.replaceMapSvg(scheme.id, editor.svgId, {
        name: String(data.get('name') ?? ''),
        ...(editor.kind === 'front' ? {
          variantCode: String(data.get('variantCode') ?? ''),
          slotCount: Number(data.get('slotCount')),
        } : {}),
        ...(replacementFile ? { file: replacementFile } : {}),
      }));
      reportUpload(result.removedItems, 'Mapa actualizado.');
      setEditor(null);
      setReplacementFile(null);
    } catch {
      // El contexto ya presentó el error.
    }
  }

  async function toggleLayer(layerId: string, enabled: boolean) {
    try {
      await commit(gateway.updateMapLayer(scheme.id, layerId, { enabled }), enabled ? 'Capa habilitada.' : 'Capa deshabilitada.');
    } catch {
      // El contexto ya presentó el error.
    }
  }

  async function toggleVariant(variant: FrontMapVariant) {
    try {
      await commit(
        gateway.replaceMapSvg(scheme.id, variant.id, { enabled: !variant.enabled }),
        variant.enabled ? 'Variante deshabilitada.' : 'Variante habilitada.',
      );
    } catch {
      // El contexto ya presentó el error.
    }
  }

  async function assign(layerId: string, locationId: string, variantId: string) {
    try {
      await commit(gateway.assignFrontVariant(scheme.id, layerId, locationId, variantId || null), 'Asignación actualizada.');
    } catch {
      // El contexto ya presentó el error.
    }
  }

  async function setDrilldown(top: TopMap, levelId: string, frontLayerId: string) {
    try {
      await commit(
        gateway.setDrilldown(scheme.id, top.id, levelId, frontLayerId || null),
        'Navegación actualizada.',
      );
    } catch {
      // El contexto ya presentó el error.
    }
  }

  async function validate() {
    try {
      const { data } = await gateway.validateMaps(scheme.id);
      setValidation(data);
      notify(data.ready ? 'La configuración de mapas está completa.' : 'La configuración todavía está incompleta.', data.ready ? 'success' : 'error');
    } catch (requestError) {
      notify(errorMessage(requestError), 'error');
    }
  }

  return (
    <section className="admin-stage" aria-labelledby="maps-title" aria-busy={pending}>
      <div className="admin-stage-heading">
        <div><h2 id="maps-title">Configurar mapas</h2><p>La vista superior es obligatoria; la frontal es opcional.</p></div>
        <span className={`admin-readiness ${validation?.ready ? 'is-ready' : ''}`}>
          {validation?.ready ? 'Completo' : `${validation?.top.missingLocationCodes.length ?? 0} sin cobertura`}
        </span>
      </div>

      <div className="admin-tabs" role="tablist" aria-label="Tipos de mapa">
        <button type="button" role="tab" aria-selected={tab === 'top'} className={tab === 'top' ? 'is-active' : ''} onClick={() => setTab('top')}>Vista superior</button>
        <button type="button" role="tab" aria-selected={tab === 'front'} className={tab === 'front' ? 'is-active' : ''} onClick={() => setTab('front')}>Vista frontal</button>
      </div>

      {tab === 'top' ? (
        <div className="admin-map-layout">
          {editable ? (
            <form className="admin-card admin-form admin-map-form" onSubmit={(event) => void saveTop(event)}>
              <div className="admin-card-heading"><h3>Nueva vista superior</h3></div>
              <div className="admin-field"><label htmlFor="top-map-name">Nombre</label><input id="top-map-name" name="name" placeholder="Plano principal" required /></div>
              <fieldset className="admin-check-list">
                <legend>Niveles representados</legend>
                {scheme.levels.map((level) => <label key={level.id}><input type="checkbox" name="representedLevelIds" value={level.id} />{level.name}</label>)}
              </fieldset>
              <label className="admin-file-field">
                <span>Archivo SVG</span>
                <input type="file" accept=".svg,image/svg+xml" onChange={(event) => chooseFile(event.target.files?.[0], 'top')} required />
                <small>{topFile?.name ?? 'Selecciona el plano superior.'}</small>
              </label>
              <button className="admin-button" type="submit" disabled={!topFile || pending}>Guardar mapa</button>
            </form>
          ) : null}

          <div className="admin-map-list">
            {scheme.topMaps.map((map) => (
              <article className={`admin-card admin-map-item${map.enabled ? '' : ' is-disabled'}`} key={map.id}>
                <div>
                  <strong>{map.name}</strong>
                  <span>{map.svgName}</span>
                  <small>{map.representedLevelIds.map((id) => scheme.levels.find((level) => level.id === id)?.name).filter(Boolean).join(', ')}</small>
                </div>
                <span className={`admin-status ${map.enabled ? 'admin-status--assigned' : 'admin-status--draft'}`}>{map.enabled ? 'Habilitada' : 'Deshabilitada'}</span>
                <div className="admin-map-item__actions">
                  {map.assetUrl ? <button className="admin-button admin-button--quiet admin-button--compact" type="button" onClick={() => setPreview({ name: map.name, assetUrl: map.assetUrl as string })}>Ver mapa</button> : null}
                  {editable && map.svgId ? <button className="admin-button admin-button--quiet admin-button--compact" type="button" onClick={() => setEditor({ kind: 'top', layerId: map.id, layerName: map.name, svgId: map.svgId as string, name: map.svgName })}>Reemplazar</button> : null}
                  {editable ? <button className="admin-button admin-button--quiet admin-button--compact" type="button" onClick={() => void toggleLayer(map.id, !map.enabled)}>{map.enabled ? 'Deshabilitar' : 'Habilitar'}</button> : null}
                  {editable ? <button className="admin-button admin-button--danger admin-button--compact" type="button" onClick={() => void commit(gateway.deleteTopMap(scheme.id, map.id), 'Mapa eliminado.').catch(() => undefined)}>Eliminar</button> : null}
                </div>
              </article>
            ))}
            {!scheme.topMaps.length ? <div className="admin-empty">No hay mapas superiores.</div> : null}
          </div>
        </div>
      ) : (
        <div className="admin-map-stack">
          {!contextLevel || !terminal ? (
            <div className="admin-empty">La vista frontal requiere un nivel de captura con un nivel superior.</div>
          ) : (
            <>
              {editable ? (
                <div className="admin-map-setup-grid">
                  <form className="admin-card admin-form admin-map-form" onSubmit={(event) => void createFrontLayer(event)}>
                    <div className="admin-card-heading"><h3>Nueva capa frontal</h3></div>
                    <div className="admin-field"><label htmlFor="front-layer-name">Nombre</label><input id="front-layer-name" name="name" placeholder={`Vista de ${terminalPlural}`} required /></div>
                    <div className="admin-field"><span className="admin-field-label">Se asigna a cada</span><output className="admin-derived-value">{contextLevel.name}</output></div>
                    <button className="admin-button" type="submit" disabled={pending}>Crear capa</button>
                  </form>

                  <form className="admin-card admin-form admin-map-form" onSubmit={(event) => void saveVariant(event)}>
                    <div className="admin-card-heading"><h3>Nueva variante</h3></div>
                    <div className="admin-field"><label htmlFor="front-layer">Capa</label><select id="front-layer" name="layerId" required><option value="">Selecciona</option>{scheme.frontLayers.map((layer) => <option key={layer.id} value={layer.id}>{layer.name}</option>)}</select></div>
                    <div className="admin-form-grid"><div className="admin-field"><label htmlFor="variant-name">Variante</label><input id="variant-name" name="variantName" placeholder="Cinco espacios" required /></div><div className="admin-field"><label htmlFor="variant-code">Código</label><input id="variant-code" name="variantCode" placeholder="variante-5" required /></div></div>
                    <div className="admin-field"><label htmlFor="slot-count">Cantidad de {terminalPlural}</label><input id="slot-count" name="slotCount" type="number" min="1" max="32767" defaultValue="5" required /></div>
                    <label className="admin-file-field"><span>Archivo SVG</span><input type="file" accept=".svg,image/svg+xml" onChange={(event) => chooseFile(event.target.files?.[0], 'variant')} required /><small>{variantFile?.name ?? 'Selecciona la vista frontal.'}</small></label>
                    <button className="admin-button" type="submit" disabled={!variantFile || !scheme.frontLayers.length || pending}>Guardar variante</button>
                  </form>
                </div>
              ) : null}

              <div className="admin-map-list">
                {scheme.frontLayers.map((layer) => {
                  const representedIndex = scheme.levels.findIndex((level) => level.id === layer.representedLevelId);
                  const layerContextLevel = scheme.levels[representedIndex - 1];
                  const contexts = scheme.locations.filter((location) => location.levelId === layerContextLevel?.id);
                  return (
                    <article className={`admin-card admin-front-layer${layer.enabled ? '' : ' is-disabled'}`} key={layer.id}>
                      <div className="admin-card-heading">
                        <div><strong>{layer.name}</strong><span>{layer.variants.length} {layer.variants.length === 1 ? 'variante' : 'variantes'}</span></div>
                        <div className="admin-map-item__actions">
                          {editable ? <button className="admin-button admin-button--quiet admin-button--compact" type="button" onClick={() => void toggleLayer(layer.id, !layer.enabled)}>{layer.enabled ? 'Deshabilitar' : 'Habilitar'}</button> : null}
                          {editable ? <button className="admin-button admin-button--danger admin-button--compact" type="button" onClick={() => void commit(gateway.deleteFrontLayer(scheme.id, layer.id), 'Capa eliminada.').catch(() => undefined)}>Eliminar</button> : null}
                        </div>
                      </div>

                      <div className="admin-variant-list">
                        {layer.variants.map((variant) => (
                          <div className="admin-variant-row" key={variant.id}>
                            <button type="button" onClick={() => setPreview({ name: variant.name, assetUrl: variant.assetUrl })}><strong>{variant.name}</strong><span>{variant.slotCount} {terminalPlural}</span></button>
                            <span className={`admin-status ${variant.enabled ? 'admin-status--assigned' : 'admin-status--draft'}`}>{variant.enabled ? 'Habilitada' : 'Deshabilitada'}</span>
                            {editable ? (
                              <div className="admin-map-item__actions">
                                <button className="admin-button admin-button--quiet admin-button--compact" type="button" onClick={() => setEditor({ kind: 'front', layerId: layer.id, layerName: layer.name, svgId: variant.id, name: variant.name, variantCode: variant.variantCode, slotCount: variant.slotCount })}>Editar</button>
                                <button className="admin-button admin-button--quiet admin-button--compact" type="button" onClick={() => void toggleVariant(variant)}>{variant.enabled ? 'Deshabilitar' : 'Habilitar'}</button>
                                <button className="admin-button admin-button--danger admin-button--compact" type="button" onClick={() => void commit(gateway.deleteMapSvg(scheme.id, variant.id), 'Variante eliminada.').catch(() => undefined)}>Eliminar</button>
                              </div>
                            ) : null}
                          </div>
                        ))}
                        {!layer.variants.length ? <div className="admin-empty">Esta capa todavía no tiene variantes.</div> : null}
                      </div>

                      <div className="admin-assignment-list">
                        {contexts.map((location) => {
                          const assignedId = layer.assignments[location.id] ?? '';
                          const childCount = scheme.locations.filter((candidate) => candidate.parentLocationId === location.id && candidate.levelId === layer.representedLevelId).length;
                          const compatible = layer.variants.filter((variant) => variant.enabled && variant.slotCount === childCount);
                          const assigned = layer.variants.find((variant) => variant.id === assignedId);
                          return (
                            <div className="admin-assignment-row" key={location.id}>
                              <span>{location.name}<small>{location.code}; {childCount} {terminalPlural}</small></span>
                              {editable ? (
                                <select aria-label={`Variante para ${location.name}`} value={assignedId} onChange={(event) => void assign(layer.id, location.id, event.target.value)}><option value="">Sin asignar</option>{compatible.map((variant) => <option key={variant.id} value={variant.id}>{variant.name}</option>)}</select>
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

              {scheme.topMaps.length && scheme.frontLayers.length ? (
                <section className="admin-card admin-drilldown" aria-labelledby="drilldown-title">
                  <div className="admin-card-heading"><div><h3 id="drilldown-title">Navegación superior a frontal</h3><span>Elige qué vista abre cada zona superior.</span></div></div>
                  {scheme.topMaps.flatMap((top) => top.representedLevelIds.map((levelId) => (
                    <label className="admin-drilldown-row" key={`${top.id}-${levelId}`}>
                      <span><strong>{top.name}</strong><small>{scheme.levels.find((level) => level.id === levelId)?.name}</small></span>
                      <select value={top.drilldowns[levelId] ?? ''} onChange={(event) => void setDrilldown(top, levelId, event.target.value)} disabled={!editable}>
                        <option value="">Sin vista frontal</option>
                        {scheme.frontLayers.map((front) => <option key={front.id} value={front.id}>{front.name}</option>)}
                      </select>
                    </label>
                  )))}
                </section>
              ) : null}
            </>
          )}
        </div>
      )}

      {preview ? (
        <section className="admin-map-preview" aria-labelledby="map-preview-title">
          <div className="admin-card-heading"><h3 id="map-preview-title">{preview.name}</h3><button className="admin-button admin-button--quiet admin-button--compact" type="button" onClick={() => setPreview(null)}>Cerrar</button></div>
          <div className="admin-map-canvas"><img src={preview.assetUrl} alt={`Vista previa de ${preview.name}`} /></div>
        </section>
      ) : null}

      {validation?.blockers.length ? <ul className="admin-warning-list">{validation.blockers.map((blocker) => <li key={blocker.code}>{blocker.message}</li>)}</ul> : null}
      <div className="admin-form-actions admin-form-actions--end"><button className="admin-button" type="button" disabled={pending} onClick={() => void validate()}>Validar mapas</button></div>

      {editor ? (
        <Modal title={editor.kind === 'top' ? 'Actualizar vista superior' : 'Actualizar variante'} onClose={() => { setEditor(null); setReplacementFile(null); }}>
          <form className="admin-form" onSubmit={(event) => void replaceSvg(event)}>
            {editor.kind === 'top' ? <div className="admin-field"><label htmlFor="edit-layer-name">Nombre de la vista</label><input id="edit-layer-name" name="layerName" defaultValue={editor.layerName} required /></div> : null}
            <div className="admin-field"><label htmlFor="edit-svg-name">Nombre del archivo</label><input id="edit-svg-name" name="name" defaultValue={editor.name} required /></div>
            {editor.kind === 'front' ? <><div className="admin-field"><label htmlFor="edit-variant-code">Código</label><input id="edit-variant-code" name="variantCode" defaultValue={editor.variantCode} required /></div><div className="admin-field"><label htmlFor="edit-slot-count">Cantidad de {terminalPlural}</label><input id="edit-slot-count" name="slotCount" type="number" min="1" max="32767" defaultValue={editor.slotCount} required /></div></> : null}
            <label className="admin-file-field"><span>Nuevo SVG (opcional)</span><input type="file" accept=".svg,image/svg+xml" onChange={(event) => chooseFile(event.target.files?.[0], 'replacement')} /><small>{replacementFile?.name ?? 'Conserva el archivo actual.'}</small></label>
            <div className="admin-form-actions"><button className="admin-button" type="submit" disabled={pending}>Guardar cambios</button><button className="admin-button admin-button--quiet" type="button" onClick={() => { setEditor(null); setReplacementFile(null); }}>Cancelar</button></div>
          </form>
        </Modal>
      ) : null}
    </section>
  );
}
