import type {
  StructureTemplateDetail,
  SubtreePreview,
  TemplateNode,
} from '@bjff/api-types';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { ApiRequestError, api } from '../api/client.js';
import { SubtreeConfirmation } from '../components/SubtreeConfirmation.js';
import { DistributionSettingsForm } from '../components/DistributionSettingsForm.js';
import { TreeEditor, type TreeEditorItem } from '../components/TreeEditor.js';

export function TemplateEditorPage() {
  const templateId = Number(useParams().id);
  const [template, setTemplate] = useState<StructureTemplateDetail | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [preview, setPreview] = useState<SubtreePreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
  const treeItems = useMemo(() => (template?.nodes ?? []).map(toTreeItem), [template]);

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
    const data = new FormData(event.currentTarget);
    await mutate(
      () =>
        api.createTemplateNode(templateId, {
          parentTemplateNodeId:
            selected?.role === 'CONTAINER' ? selected.structureTemplateNodeId : null,
          name: String(data.get('name')),
          role: String(data.get('role')) as 'CONTAINER' | 'POSITION',
          enabled: true,
        }),
      'Nodo agregado.',
    );
    event.currentTarget.reset();
  }

  async function reorder(parentId: number | null, ids: number[]): Promise<void> {
    await mutate(
      () =>
        api.orderTemplateNodes(templateId, {
          parentTemplateNodeId: parentId,
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

  if (!template) return <p role="status">Cargando…</p>;
  const editable = template.status === 'DRAFT';

  return (
    <section>
      <Link to="/plantillas" className="text-sm underline">
        ← Plantillas
      </Link>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <h2 className="text-xl font-semibold">{template.name}</h2>
        <span className="rounded bg-slate-100 px-2 py-1 text-xs dark:bg-slate-800">
          {template.status}
        </span>
      </div>
      <p className="text-sm text-slate-600">{template.description}</p>
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
        <form
          onSubmit={(event) => void addNode(event)}
          className="my-4 flex flex-wrap items-end gap-3 rounded border p-3"
        >
          <label className="grid gap-1 text-sm">
            Nombre
            <input
              name="name"
              required
              maxLength={40}
              className="rounded border px-3 py-2"
            />
          </label>
          <label className="grid gap-1 text-sm">
            Rol
            <select name="role" className="rounded border px-3 py-2">
              <option value="CONTAINER">Contenedor</option>
              <option value="POSITION">Posición</option>
            </select>
          </label>
          <span className="text-xs text-slate-500">
            {selected?.role === 'CONTAINER' ? `Hija de ${selected.name}` : 'Nueva raíz'}
          </span>
          <button disabled={busy} className="rounded bg-sky-700 px-3 py-2 text-white">
            Agregar
          </button>
        </form>
      )}
      <button
        type="button"
        disabled={busy}
        onClick={() =>
          void mutate(
            () => api.updateTemplate(templateId, { enabled: !template.enabled }),
            template.enabled ? 'Plantilla deshabilitada.' : 'Plantilla habilitada.',
          )
        }
        className="mt-4 mr-2 rounded border px-4 py-2"
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
          className="mt-4 rounded border border-amber-500 px-4 py-2"
        >
          Archivar plantilla
        </button>
      )}

      <TreeEditor
        items={treeItems}
        editable={editable}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onReorder={reorder}
        onDelete={(id) => void requestDeletion(id)}
      />

      {editable && selected?.role === 'POSITION' && (
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
                api.updateTemplateNode(templateId, selected.structureTemplateNodeId, {
                  defaults,
                }),
              'Defaults actualizados.',
            )
          }
          onClear={() =>
            mutate(
              () =>
                api.updateTemplateNode(templateId, selected.structureTemplateNodeId, {
                  defaults: null,
                }),
              'Defaults eliminados.',
            )
          }
        />
      )}

      {preview && (
        <div className="mt-4">
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
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            void mutate(() => api.activateTemplate(templateId), 'Plantilla activada.')
          }
          className="mt-6 rounded bg-emerald-700 px-4 py-2 font-medium text-white disabled:opacity-60"
        >
          Activar plantilla
        </button>
      )}
      {!editable && (
        <p className="mt-5 rounded border p-3 text-sm">
          La jerarquía está protegida porque la plantilla ya no está en DRAFT.
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
