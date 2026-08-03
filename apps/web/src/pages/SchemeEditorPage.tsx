import type {
  SchemeDetail,
  SchemeLocation,
  SchemeUnavailableReason,
  StructureTemplateDetail,
  SubtreePreview,
  TemplateNode,
} from '@bjff/api-types';
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { ApiRequestError, api } from '../api/client.js';
import { DistributionSettingsForm } from '../components/DistributionSettingsForm.js';
import { SubtreeConfirmation } from '../components/SubtreeConfirmation.js';
import { TreeEditor, type TreeEditorItem } from '../components/TreeEditor.js';

export function SchemeEditorPage() {
  const schemeId = Number(useParams().id);
  const [scheme, setScheme] = useState<SchemeDetail | null>(null);
  const [templates, setTemplates] = useState<StructureTemplateDetail[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [parentLocationId, setParentLocationId] = useState<number | ''>('');
  const [templateId, setTemplateId] = useState<number | ''>('');
  const [nodeId, setNodeId] = useState<number | ''>('');
  const [baseName, setBaseName] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [startAt, setStartAt] = useState(1);
  const [editName, setEditName] = useState('');
  const [preview, setPreview] = useState<SubtreePreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const reload = useCallback(
    async () => setScheme(await api.scheme(schemeId)),
    [schemeId],
  );

  useEffect(() => {
    void reload().catch(() => setError('No se pudo obtener el esquema.'));
    void api.templates().then(async (page) => {
      const available = page.items.filter(
        (item) => item.status === 'ACTIVE' && item.enabled,
      );
      setTemplates(
        await Promise.all(
          available.map((item) => api.template(item.structureTemplateId)),
        ),
      );
    });
  }, [reload]);

  const flatLocations = useMemo(
    () => flattenLocations(scheme?.locations ?? []),
    [scheme],
  );
  const selected = flatLocations.find((item) => item.locationId === selectedId) ?? null;
  const parent =
    flatLocations.find((item) => item.locationId === parentLocationId) ?? null;
  const selectedTemplate =
    templates.find((item) => item.structureTemplateId === templateId) ?? null;
  const candidateNodes = compatibleNodes(selectedTemplate, parent);
  const namesPreview = buildNames(baseName.trim(), quantity, startAt);

  useEffect(() => {
    setEditName(selected?.name ?? '');
  }, [selected]);

  async function mutate(work: () => Promise<unknown>, message: string): Promise<void> {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await work();
      await reload();
      setNotice(message);
    } catch (cause) {
      await reload().catch(() => undefined);
      setError(
        cause instanceof ApiRequestError
          ? cause.message
          : 'No se pudo guardar el cambio.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function add(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (templateId === '' || nodeId === '' || !baseName.trim()) {
      setError('Completá la plantilla, el nivel y el nombre base.');
      return;
    }

    const names = buildNames(baseName.trim(), quantity, startAt);
    let lastCreatedId: number | null = null;
    await mutate(
      async () => {
        for (const name of names) {
          const created = await api.createLocation(schemeId, {
            parentLocationId: parentLocationId === '' ? null : parentLocationId,
            structureTemplateId: templateId,
            structureTemplateNodeId: nodeId,
            name,
            enabled: true,
          });
          lastCreatedId = created.locationId;
        }
      },
      names.length === 1
        ? 'Ubicación agregada.'
        : `${names.length} ubicaciones agregadas.`,
    );

    if (lastCreatedId !== null) {
      setSelectedId(lastCreatedId);
      nameInputRef.current?.focus();
    }
  }

  async function renameSelected(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!selected) return;
    await mutate(
      () => api.updateLocation(schemeId, selected.locationId, { name: editName.trim() }),
      'Nombre actualizado.',
    );
  }

  async function reorder(parentId: number | null, ids: number[]): Promise<void> {
    await mutate(
      () =>
        api.orderLocations(schemeId, {
          parentLocationId: parentId,
          orderedLocationIds: ids,
        }),
      'Orden actualizado.',
    );
  }

  function chooseTemplate(value: string): void {
    const nextTemplateId = value === '' ? '' : Number(value);
    setTemplateId(nextTemplateId);
    setNodeId('');
    setBaseName('');
    if (nextTemplateId === '') return;
    const nextTemplate = templates.find(
      (item) => item.structureTemplateId === nextTemplateId,
    );
    const first = compatibleNodes(nextTemplate ?? null, null)[0];
    if (first) {
      setNodeId(first.structureTemplateNodeId);
      setBaseName(first.name);
    }
  }

  function chooseParent(value: string): void {
    const nextParentId = value === '' ? '' : Number(value);
    setParentLocationId(nextParentId);
    setNodeId('');
    setBaseName('');
    if (nextParentId === '') return;
    const nextParent = flatLocations.find(
      (location) => location.locationId === nextParentId,
    );
    if (!nextParent) return;
    setTemplateId(nextParent.structureTemplateId);
    const nextTemplate = templates.find(
      (item) => item.structureTemplateId === nextParent.structureTemplateId,
    );
    const first = compatibleNodes(nextTemplate ?? null, nextParent)[0];
    if (first) {
      setNodeId(first.structureTemplateNodeId);
      setBaseName(first.name);
    }
  }

  function chooseNode(value: string): void {
    const nextNodeId = value === '' ? '' : Number(value);
    setNodeId(nextNodeId);
    const node = candidateNodes.find(
      (item) => item.structureTemplateNodeId === nextNodeId,
    );
    setBaseName(node?.name ?? '');
  }

  function prepareChild(locationId: number): void {
    chooseParent(String(locationId));
    setSelectedId(locationId);
    nameInputRef.current?.focus();
  }

  if (!scheme) return <p role="status">Cargando…</p>;
  const editable = scheme.status === 'DRAFT';

  return (
    <section>
      <Link to="/esquemas/schemes" className="back-link">
        Volver a esquemas físicos
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-2xl font-semibold text-[#002855]">{scheme.name}</h2>
            <span className="status-pill">
              {scheme.status === 'DRAFT' ? 'Borrador' : 'Definido'}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-600">{scheme.description}</p>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            void mutate(
              () => api.updateScheme(schemeId, { enabled: !scheme.enabled }),
              scheme.enabled ? 'Esquema deshabilitado.' : 'Esquema habilitado.',
            )
          }
          className="button-secondary"
        >
          {scheme.enabled ? 'Deshabilitar esquema' : 'Habilitar esquema'}
        </button>
      </div>

      {!scheme.availableForNewRun && (
        <p className="mt-3 rounded border border-amber-300 bg-amber-50 p-3 text-sm">
          No está disponible para una nueva corrida:{' '}
          {scheme.unavailableReasons.map(availabilityReason).join(', ')}.
        </p>
      )}
      <p role="status" className="mt-3 min-h-5 text-sm text-emerald-700">
        {notice}
      </p>
      <p role="alert" className="min-h-5 text-sm text-red-700">
        {error}
      </p>

      {editable && (
        <form onSubmit={(event) => void add(event)} className="surface my-5 p-5">
          <div className="mb-4">
            <h3 className="font-semibold text-[#002855]">Añadir ubicaciones</h3>
            <p className="helper-text mt-1">
              Elegí el contenedor y generá una o varias instancias con nombres
              consecutivos.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <label className="grid gap-1 text-sm">
              Ubicación
              <select
                value={parentLocationId}
                onChange={(event) => chooseParent(event.target.value)}
              >
                <option value="">Como raíz</option>
                {flatLocations
                  .filter((location) => location.role === 'CONTAINER' && location.enabled)
                  .map((location) => (
                    <option key={location.locationId} value={location.locationId}>
                      Dentro de {location.name}
                    </option>
                  ))}
              </select>
            </label>

            <label className="grid gap-1 text-sm">
              Plantilla
              <select
                value={templateId}
                disabled={parentLocationId !== ''}
                onChange={(event) => chooseTemplate(event.target.value)}
              >
                <option value="">Seleccioná una plantilla</option>
                {templates.map((template) => (
                  <option
                    key={template.structureTemplateId}
                    value={template.structureTemplateId}
                  >
                    {template.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-1 text-sm">
              Nivel que se instanciará
              <select value={nodeId} onChange={(event) => chooseNode(event.target.value)}>
                <option value="">Seleccioná un nivel</option>
                {candidateNodes.map((node) => (
                  <option
                    key={node.structureTemplateNodeId}
                    value={node.structureTemplateNodeId}
                  >
                    {node.name} ({node.role === 'POSITION' ? 'posición' : 'contenedor'})
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-1 text-sm lg:col-span-2">
              Nombre base
              <input
                ref={nameInputRef}
                required
                maxLength={60}
                value={baseName}
                onChange={(event) => setBaseName(event.target.value)}
                placeholder="Ejemplo: Estantería"
              />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="grid gap-1 text-sm">
                Cantidad
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={quantity}
                  onChange={(event) =>
                    setQuantity(clampInteger(Number(event.target.value), 1, 50))
                  }
                />
              </label>
              <label className="grid gap-1 text-sm">
                Numerar desde
                <input
                  type="number"
                  min="1"
                  max="9999"
                  disabled={quantity === 1}
                  value={startAt}
                  onChange={(event) =>
                    setStartAt(clampInteger(Number(event.target.value), 1, 9999))
                  }
                />
              </label>
            </div>
          </div>

          {baseName.trim() && (
            <p className="helper-text mt-4">
              Se crearán: {namesPreview.slice(0, 4).join(', ')}
              {namesPreview.length > 4 ? ` y ${namesPreview.length - 4} más` : ''}.
            </p>
          )}
          <button
            disabled={
              busy || templateId === '' || nodeId === '' || baseName.trim() === ''
            }
            className="button-primary mt-4"
          >
            {quantity === 1 ? 'Añadir ubicación' : `Añadir ${quantity} ubicaciones`}
          </button>
        </form>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
        <div>
          <h3 className="font-semibold text-[#002855]">Estructura física</h3>
          <p className="helper-text mt-1 mb-3">
            Usá Añadir dentro para continuar una rama sin volver a configurar el padre.
          </p>
          <TreeEditor
            items={scheme.locations.map(toTreeItem)}
            editable={editable}
            selectedId={selectedId}
            selectionLabel="Configurar"
            onSelect={setSelectedId}
            onAddChild={prepareChild}
            onReorder={reorder}
            onDelete={(id) =>
              void api
                .locationDeletionPreview(schemeId, id)
                .then(setPreview)
                .catch(() => setError('No se pudo calcular el impacto.'))
            }
          />
        </div>

        <aside>
          {selected ? (
            <div className="surface p-5 lg:sticky lg:top-4">
              <h3 className="font-semibold text-[#002855]">Ubicación seleccionada</h3>
              <p className="helper-text mt-1">
                {selected.role === 'POSITION'
                  ? 'Esta posición puede recibir configuración de distribución.'
                  : 'Los valores definidos aquí pueden heredarse a sus posiciones.'}
              </p>

              {editable && (
                <form
                  onSubmit={(event) => void renameSelected(event)}
                  className="mt-4 grid gap-2"
                >
                  <label className="grid gap-1 text-sm">
                    Nombre
                    <input
                      required
                      maxLength={60}
                      value={editName}
                      onChange={(event) => setEditName(event.target.value)}
                    />
                  </label>
                  <button
                    disabled={busy || !editName.trim() || editName === selected.name}
                    className="button-secondary justify-self-start"
                  >
                    Guardar nombre
                  </button>
                </form>
              )}

              <DistributionSettingsForm
                key={selected.locationId}
                initial={
                  selected.settings ?? {
                    capacity: null,
                    targetFillRatio: null,
                    allowOverflow: null,
                  }
                }
                busy={busy}
                inheritance={selected.role}
                onSave={(settings) =>
                  mutate(
                    () =>
                      api.replaceLocationSettings(
                        schemeId,
                        selected.locationId,
                        settings,
                      ),
                    'Configuración actualizada.',
                  )
                }
                onClear={() =>
                  mutate(
                    () => api.deleteLocationSettings(schemeId, selected.locationId),
                    'Configuración eliminada.',
                  )
                }
              />
            </div>
          ) : (
            <div className="surface p-5">
              <h3 className="font-semibold text-[#002855]">Configuración</h3>
              <p className="helper-text mt-2">
                Seleccioná Configurar en una ubicación para editar su nombre, capacidad y
                objetivo de llenado.
              </p>
            </div>
          )}
        </aside>
      </div>

      {preview && (
        <div className="mt-5">
          <SubtreeConfirmation
            preview={preview}
            busy={busy}
            onCancel={() => setPreview(null)}
            onConfirm={() =>
              void mutate(
                () =>
                  api
                    .deleteLocation(schemeId, preview.root.id, true)
                    .then(() => setPreview(null)),
                'Subárbol eliminado.',
              )
            }
          />
        </div>
      )}

      {editable && (
        <div className="mt-6 border-t border-slate-200 pt-5">
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              void mutate(
                () => api.defineScheme(schemeId),
                'Esquema definido y secuenciado.',
              )
            }
            className="button-primary"
          >
            Definir esquema
          </button>
          <p className="helper-text mt-2">
            Al definirlo, la estructura quedará protegida y sus posiciones recibirán una
            secuencia global.
          </p>
        </div>
      )}
      {!editable && (
        <p className="mt-5 rounded border border-slate-200 bg-white p-3 text-sm">
          La estructura está definida y es de solo lectura. Los números visibles
          corresponden a la secuencia global calculada.
        </p>
      )}
    </section>
  );
}

function compatibleNodes(
  template: StructureTemplateDetail | null,
  parent: SchemeLocation | null,
): TemplateNode[] {
  if (!template) return [];
  if (!parent) {
    return template.nodes.filter(
      (node) => node.parentTemplateNodeId === null && node.enabled,
    );
  }
  return flattenNodes(template.nodes).filter(
    (node) =>
      node.parentTemplateNodeId === parent.structureTemplateNodeId && node.enabled,
  );
}

function availabilityReason(reason: SchemeUnavailableReason): string {
  const labels: Record<SchemeUnavailableReason, string> = {
    SCHEME_DISABLED: 'el esquema está deshabilitado',
    SCHEME_NOT_DEFINED: 'todavía no está definido',
    TEMPLATE_DISABLED: 'usa una plantilla deshabilitada',
    NO_USABLE_POSITIONS: 'no tiene posiciones utilizables',
  };
  return labels[reason];
}

function buildNames(baseName: string, quantity: number, startAt: number): string[] {
  if (!baseName) return [];
  if (quantity === 1) return [baseName];
  return Array.from({ length: quantity }, (_, index) => `${baseName} ${startAt + index}`);
}

function clampInteger(value: number, minimum: number, maximum: number): number {
  if (!Number.isFinite(value)) return minimum;
  return Math.min(maximum, Math.max(minimum, Math.trunc(value)));
}

function flattenLocations(nodes: SchemeLocation[]): SchemeLocation[] {
  return nodes.flatMap((node) => [node, ...flattenLocations(node.children)]);
}

function flattenNodes(nodes: TemplateNode[]): TemplateNode[] {
  return nodes.flatMap((node) => [node, ...flattenNodes(node.children)]);
}

function toTreeItem(location: SchemeLocation): TreeEditorItem {
  return {
    id: location.locationId,
    name: location.name,
    role: location.role,
    enabled: location.enabled,
    secondary:
      location.leafSequence === null ? null : `Secuencia ${location.leafSequence}`,
    children: location.children.map(toTreeItem),
  };
}
