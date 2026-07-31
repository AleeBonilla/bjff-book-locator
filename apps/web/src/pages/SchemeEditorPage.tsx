import type {
  SchemeDetail,
  SchemeLocation,
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

export function SchemeEditorPage() {
  const schemeId = Number(useParams().id);
  const [scheme, setScheme] = useState<SchemeDetail | null>(null);
  const [templates, setTemplates] = useState<StructureTemplateDetail[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [templateId, setTemplateId] = useState<number | null>(null);
  const [nodeId, setNodeId] = useState<number | null>(null);
  const [preview, setPreview] = useState<SubtreePreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(
    async () => setScheme(await api.scheme(schemeId)),
    [schemeId],
  );
  useEffect(() => {
    void reload().catch(() => setError('No se pudo obtener el scheme.'));
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
  const selectedTemplate =
    templates.find((item) => item.structureTemplateId === templateId) ?? null;
  const candidateNodes = selected
    ? flattenNodes(selectedTemplate?.nodes ?? []).filter(
        (node) =>
          node.parentTemplateNodeId === selected.structureTemplateNodeId && node.enabled,
      )
    : (selectedTemplate?.nodes ?? []).filter(
        (node) => node.parentTemplateNodeId === null && node.enabled,
      );

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

  async function add(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!templateId || !nodeId) {
      setError('Seleccione una plantilla y un nodo compatible.');
      return;
    }
    const data = new FormData(event.currentTarget);
    await mutate(
      () =>
        api.createLocation(schemeId, {
          parentLocationId: selected?.locationId ?? null,
          structureTemplateId: templateId,
          structureTemplateNodeId: nodeId,
          name: String(data.get('name')),
          enabled: true,
        }),
      'Location agregada.',
    );
    event.currentTarget.reset();
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

  if (!scheme) return <p role="status">Cargando…</p>;
  const editable = scheme.status === 'DRAFT';

  return (
    <section>
      <Link to="/schemes" className="text-sm underline">
        ← Schemes
      </Link>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <h2 className="text-xl font-semibold">{scheme.name}</h2>
        <span className="rounded bg-slate-100 px-2 py-1 text-xs">{scheme.status}</span>
      </div>
      <p className="text-sm text-slate-600">{scheme.description}</p>
      {!scheme.availableForNewRun && (
        <p className="mt-2 rounded border border-amber-300 p-2 text-sm">
          No disponible para una nueva corrida: {scheme.unavailableReasons.join(', ')}.
        </p>
      )}
      <p role="status" className="mt-3 min-h-5 text-sm text-emerald-700">
        {notice}
      </p>
      <p role="alert" className="min-h-5 text-sm text-red-700">
        {error}
      </p>
      {editable && (
        <form
          onSubmit={(event) => void add(event)}
          className="my-4 grid gap-3 rounded border p-3 md:grid-cols-4"
        >
          <label className="grid gap-1 text-sm">
            Plantilla
            <select
              value={templateId ?? ''}
              onChange={(event) => {
                setTemplateId(Number(event.target.value));
                setNodeId(null);
              }}
              className="rounded border px-3 py-2"
            >
              <option value="">Seleccione</option>
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
            Nodo
            <select
              value={nodeId ?? ''}
              onChange={(event) => setNodeId(Number(event.target.value))}
              className="rounded border px-3 py-2"
            >
              <option value="">Seleccione</option>
              {candidateNodes.map((node) => (
                <option
                  key={node.structureTemplateNodeId}
                  value={node.structureTemplateNodeId}
                >
                  {node.name} · {node.role}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            Nombre físico
            <input
              name="name"
              required
              maxLength={60}
              className="rounded border px-3 py-2"
            />
          </label>
          <button
            disabled={busy}
            className="self-end rounded bg-sky-700 px-3 py-2 text-white"
          >
            Agregar
          </button>
          <p className="text-xs text-slate-500 md:col-span-4">
            {selected
              ? `Se agregará bajo ${selected.name}. Seleccione la misma plantilla de esa instancia.`
              : 'Se agregará como raíz.'}
          </p>
        </form>
      )}
      <TreeEditor
        items={scheme.locations.map(toTreeItem)}
        editable={editable}
        selectedId={selectedId}
        onSelect={(id) => {
          const location = flatLocations.find((item) => item.locationId === id);
          setSelectedId(id);
          setTemplateId(location?.structureTemplateId ?? null);
          setNodeId(null);
        }}
        onReorder={reorder}
        onDelete={(id) =>
          void api
            .locationDeletionPreview(schemeId, id)
            .then(setPreview)
            .catch(() => setError('No se pudo calcular el impacto.'))
        }
      />
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
                    .deleteLocation(schemeId, preview.root.id, true)
                    .then(() => setPreview(null)),
                'Subárbol eliminado.',
              )
            }
          />
        </div>
      )}
      {selected && (
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
              () => api.replaceLocationSettings(schemeId, selected.locationId, settings),
              'Settings actualizados.',
            )
          }
          onClear={() =>
            mutate(
              () => api.deleteLocationSettings(schemeId, selected.locationId),
              'Settings eliminados.',
            )
          }
        />
      )}
      {editable && (
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            void mutate(
              () => api.defineScheme(schemeId),
              'Scheme definido y secuenciado.',
            )
          }
          className="mt-6 rounded bg-emerald-700 px-4 py-2 font-medium text-white disabled:opacity-60"
        >
          Definir scheme
        </button>
      )}
      {!editable && (
        <p className="mt-5 rounded border p-3 text-sm">
          La estructura está definida y es de solo lectura. Los números visibles son la
          secuencia global derivada.
        </p>
      )}
      <button
        type="button"
        disabled={busy}
        onClick={() =>
          void mutate(
            () => api.updateScheme(schemeId, { enabled: !scheme.enabled }),
            scheme.enabled ? 'Scheme deshabilitado.' : 'Scheme habilitado.',
          )
        }
        className="mt-4 rounded border px-4 py-2"
      >
        {scheme.enabled ? 'Deshabilitar scheme' : 'Habilitar scheme'}
      </button>
    </section>
  );
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
