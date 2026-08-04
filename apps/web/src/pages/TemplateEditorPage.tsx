import type {
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

export function TemplateEditorPage() {
  const templateId = Number(useParams().id);
  const [template, setTemplate] = useState<StructureTemplateDetail | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [parentId, setParentId] = useState<number | ''>('');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState<'CONTAINER' | 'POSITION'>('CONTAINER');
  const [editName, setEditName] = useState('');
  const [preview, setPreview] = useState<SubtreePreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const reload = useCallback(async () => {
    try {
      setTemplate(await api.template(templateId));
    } catch {
      setError('No se pudo obtener la plantilla.');
    }
  }, [templateId]);

  useEffect(() => void reload(), [reload]);

  const flat = useMemo(() => flatten(template?.nodes ?? []), [template]);
  const selected =
    flat.find((node) => node.structureTemplateNodeId === selectedId) ?? null;
  const containers = flat.filter((node) => node.role === 'CONTAINER' && node.enabled);
  const treeItems = useMemo(() => (template?.nodes ?? []).map(toTreeItem), [template]);

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
      setError(
        cause instanceof ApiRequestError
          ? cause.message
          : 'No se pudo guardar el cambio.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function addNode(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    let createdId: number | null = null;
    await mutate(async () => {
      const created = await api.createTemplateNode(templateId, {
        parentTemplateNodeId: parentId === '' ? null : parentId,
        name: newName.trim(),
        role: newRole,
        enabled: true,
      });
      createdId = created.structureTemplateNodeId;
    }, 'Nivel agregado a la plantilla.');
    if (createdId !== null) {
      setSelectedId(createdId);
      setNewName('');
      nameInputRef.current?.focus();
    }
  }

  async function renameSelected(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!selected) return;
    await mutate(
      () =>
        api.updateTemplateNode(templateId, selected.structureTemplateNodeId, {
          name: editName.trim(),
        }),
      'Nombre actualizado.',
    );
  }

  async function reorder(parent: number | null, ids: number[]): Promise<void> {
    await mutate(
      () =>
        api.orderTemplateNodes(templateId, {
          parentTemplateNodeId: parent,
          orderedNodeIds: ids,
        }),
      'Orden actualizado.',
    );
  }

  async function requestDeletion(nodeId: number): Promise<void> {
    try {
      setPreview(await api.templateNodeDeletionPreview(templateId, nodeId));
    } catch (cause) {
      setError(
        cause instanceof ApiRequestError
          ? cause.message
          : 'No se pudo calcular el impacto.',
      );
    }
  }

  function prepareChild(parent: number): void {
    setParentId(parent);
    setSelectedId(parent);
    setNewName('');
    nameInputRef.current?.focus();
  }

  if (!template) return <p role="status">Cargando…</p>;
  const editable = template.status === 'DRAFT';

  return (
    <section>
      <Link to="/esquemas/plantillas" className="back-link">
        Volver a plantillas
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-2xl font-semibold text-[#002855]">{template.name}</h2>
            <span className="status-pill">
              {template.status === 'DRAFT'
                ? 'Borrador'
                : template.status === 'ACTIVE'
                  ? 'Activa'
                  : 'Archivada'}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-600">{template.description}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              void mutate(
                () => api.updateTemplate(templateId, { enabled: !template.enabled }),
                template.enabled ? 'Plantilla deshabilitada.' : 'Plantilla habilitada.',
              )
            }
            className="button-secondary"
          >
            {template.enabled ? 'Deshabilitar plantilla' : 'Habilitar plantilla'}
          </button>
          {template.status === 'ACTIVE' && (
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                void mutate(() => api.archiveTemplate(templateId), 'Plantilla archivada.')
              }
              className="button-secondary"
            >
              Archivar plantilla
            </button>
          )}
        </div>
      </div>

      <p
        role="status"
        aria-live="polite"
        className="mt-3 min-h-5 text-sm text-emerald-700"
      >
        {notice}
      </p>
      <p role="alert" className="min-h-5 text-sm text-red-700">
        {error}
      </p>

      {editable && (
        <form onSubmit={(event) => void addNode(event)} className="surface my-5 p-5">
          <div className="mb-4">
            <h3 className="font-semibold text-[#002855]">Añadir nivel</h3>
            <p className="helper-text mt-1">
              Elegí explícitamente dónde se ubicará. También podés usar “Añadir dentro”
              desde cualquier contenedor del árbol.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-4">
            <label className="grid gap-1 text-sm">
              Ubicación
              <select
                value={parentId}
                onChange={(event) =>
                  setParentId(event.target.value === '' ? '' : Number(event.target.value))
                }
              >
                <option value="">Como raíz</option>
                {containers.map((node) => (
                  <option
                    key={node.structureTemplateNodeId}
                    value={node.structureTemplateNodeId}
                  >
                    Dentro de {node.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm md:col-span-2">
              Nombre del nivel
              <input
                ref={nameInputRef}
                required
                maxLength={40}
                value={newName}
                onChange={(event) => setNewName(event.target.value)}
                placeholder="Ejemplo: Estantería"
              />
            </label>
            <label className="grid gap-1 text-sm">
              Tipo
              <select
                value={newRole}
                onChange={(event) =>
                  setNewRole(event.target.value as 'CONTAINER' | 'POSITION')
                }
              >
                <option value="CONTAINER">Contenedor</option>
                <option value="POSITION">Posición final</option>
              </select>
            </label>
          </div>
          <button disabled={busy || !newName.trim()} className="button-primary mt-4">
            Añadir nivel
          </button>
        </form>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
        <div>
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <h3 className="font-semibold text-[#002855]">Estructura de la plantilla</h3>
              <p className="helper-text mt-1">
                Arrastrá elementos o usá Subir y Bajar para cambiar su orden.
              </p>
            </div>
          </div>
          <TreeEditor
            items={treeItems}
            editable={editable}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onAddChild={prepareChild}
            onReorder={reorder}
            onDelete={(id) => void requestDeletion(id)}
          />
        </div>

        <aside>
          {selected ? (
            <div className="surface p-5 lg:sticky lg:top-4">
              <h3 className="font-semibold text-[#002855]">Nivel seleccionado</h3>
              <p className="helper-text mt-1">
                {selected.role === 'POSITION'
                  ? 'Esta posición recibirá libros cuando se distribuya la colección.'
                  : 'Este contenedor puede recibir otros niveles.'}
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
                      maxLength={40}
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

              {editable && selected.role === 'POSITION' && (
                <DistributionSettingsForm
                  key={selected.structureTemplateNodeId}
                  initial={
                    selected.defaults ?? {
                      capacity: null,
                      targetFillRatio: null,
                      allowOverflow: null,
                    }
                  }
                  busy={busy}
                  inheritance="POSITION"
                  onSave={(defaults) =>
                    mutate(
                      () =>
                        api.updateTemplateNode(
                          templateId,
                          selected.structureTemplateNodeId,
                          { defaults },
                        ),
                      'Valores predeterminados actualizados.',
                    )
                  }
                  onClear={() =>
                    mutate(
                      () =>
                        api.updateTemplateNode(
                          templateId,
                          selected.structureTemplateNodeId,
                          { defaults: null },
                        ),
                      'Valores predeterminados eliminados.',
                    )
                  }
                />
              )}
            </div>
          ) : (
            <div className="surface p-5">
              <h3 className="font-semibold text-[#002855]">Edición del nivel</h3>
              <p className="helper-text mt-2">
                Seleccioná Editar en un elemento para cambiar su nombre o configurar una
                posición final.
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
                    .deleteTemplateNode(templateId, preview.root.id, true)
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
              void mutate(() => api.activateTemplate(templateId), 'Plantilla activada.')
            }
            className="button-primary"
          >
            Activar plantilla
          </button>
          <p className="helper-text mt-2">
            Al activarla, la jerarquía quedará protegida y podrá usarse en esquemas.
          </p>
        </div>
      )}
      {!editable && (
        <p className="mt-5 rounded border border-slate-200 bg-white p-3 text-sm">
          La jerarquía está protegida porque la plantilla ya no está en borrador.
        </p>
      )}
    </section>
  );
}

function flatten(nodes: TemplateNode[]): TemplateNode[] {
  return nodes.flatMap((node) => [node, ...flatten(node.children)]);
}

function toTreeItem(node: TemplateNode): TreeEditorItem {
  return {
    id: node.structureTemplateNodeId,
    name: node.name,
    role: node.role,
    enabled: node.enabled,
    children: node.children.map(toTreeItem),
  };
}
