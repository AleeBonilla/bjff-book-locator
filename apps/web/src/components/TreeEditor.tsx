import { useState } from 'react';

export interface TreeEditorItem {
  id: number;
  name: string;
  role: 'CONTAINER' | 'POSITION';
  enabled: boolean;
  children: TreeEditorItem[];
  secondary?: string | null;
}

export function TreeEditor({
  items,
  editable,
  selectedId,
  selectionLabel = 'Editar',
  onSelect,
  onAddChild,
  onReorder,
  onDelete,
}: {
  items: TreeEditorItem[];
  editable: boolean;
  selectedId?: number | null;
  selectionLabel?: string;
  onSelect?: (id: number) => void;
  onAddChild?: (id: number) => void;
  onReorder?: (parentId: number | null, orderedIds: number[]) => Promise<void>;
  onDelete?: (id: number) => void;
}) {
  const [busy, setBusy] = useState<number | null>(null);
  const [draggedId, setDraggedId] = useState<number | null>(null);

  async function move(
    group: TreeEditorItem[],
    parentId: number | null,
    index: number,
    direction: -1 | 1,
  ): Promise<void> {
    if (!onReorder) return;
    const target = index + direction;
    if (target < 0 || target >= group.length) return;
    const ids = group.map((item) => item.id);
    [ids[index], ids[target]] = [ids[target]!, ids[index]!];
    setBusy(group[index]!.id);
    try {
      await onReorder(parentId, ids);
    } finally {
      setBusy(null);
    }
  }

  async function drop(
    group: TreeEditorItem[],
    parentId: number | null,
    targetIndex: number,
  ): Promise<void> {
    if (!onReorder || draggedId === null) return;
    const sourceIndex = group.findIndex((item) => item.id === draggedId);
    setDraggedId(null);
    if (sourceIndex < 0 || sourceIndex === targetIndex) return;
    const ids = group.map((item) => item.id);
    const [moved] = ids.splice(sourceIndex, 1);
    ids.splice(targetIndex, 0, moved!);
    setBusy(moved!);
    try {
      await onReorder(parentId, ids);
    } finally {
      setBusy(null);
    }
  }

  const renderGroup = (group: TreeEditorItem[], parentId: number | null) => (
    <ul
      className={
        parentId === null
          ? 'space-y-3'
          : 'mt-3 ml-5 space-y-3 border-l-2 border-[#d5dde2] pl-4'
      }
    >
      {group.map((item, index) => (
        <li
          key={item.id}
          draggable={editable && Boolean(onReorder)}
          onDragStart={() => setDraggedId(item.id)}
          onDragEnd={() => setDraggedId(null)}
          onDragOver={(event) => {
            if (draggedId !== null) event.preventDefault();
          }}
          onDrop={(event) => {
            event.preventDefault();
            void drop(group, parentId, index);
          }}
        >
          <div
            className={`rounded border-l-4 bg-white p-3 shadow-sm ${
              selectedId === item.id
                ? 'border border-[#008285] border-l-[#008285] bg-[#f1f9f9]'
                : 'border border-slate-200 border-l-[#002855]'
            }`}
          >
            <div className="flex flex-wrap items-center gap-2">
              <strong className="text-sm text-[#002855]">{item.name}</strong>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                {item.role === 'POSITION' ? 'Posición' : 'Contenedor'}
              </span>
              {!item.enabled && (
                <span className="text-xs font-medium text-amber-700">Deshabilitado</span>
              )}
              {item.secondary && (
                <span className="text-xs text-slate-500">{item.secondary}</span>
              )}
            </div>

            {(onSelect || (editable && onReorder) || (editable && onAddChild)) && (
              <div className="mt-3 flex flex-wrap gap-2">
                {onSelect && (
                  <button
                    type="button"
                    onClick={() => onSelect(item.id)}
                    className="button-quiet min-h-0 px-3 py-1 text-xs"
                  >
                    {selectionLabel}
                  </button>
                )}
                {editable && onAddChild && item.role === 'CONTAINER' && (
                  <button
                    type="button"
                    onClick={() => onAddChild(item.id)}
                    className="button-secondary min-h-0 px-3 py-1 text-xs"
                  >
                    Añadir dentro
                  </button>
                )}
                {editable && onReorder && (
                  <>
                    <button
                      type="button"
                      disabled={index === 0 || busy !== null}
                      onClick={() => void move(group, parentId, index, -1)}
                      className="button-quiet min-h-0 px-3 py-1 text-xs"
                    >
                      Subir
                    </button>
                    <button
                      type="button"
                      disabled={index === group.length - 1 || busy !== null}
                      onClick={() => void move(group, parentId, index, 1)}
                      className="button-quiet min-h-0 px-3 py-1 text-xs"
                    >
                      Bajar
                    </button>
                    {onDelete && (
                      <button
                        type="button"
                        onClick={() => onDelete(item.id)}
                        className="button-danger min-h-0 px-3 py-1 text-xs"
                      >
                        Eliminar
                      </button>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
          {item.children.length > 0 && renderGroup(item.children, item.id)}
        </li>
      ))}
    </ul>
  );

  return items.length === 0 ? (
    <div className="rounded border border-dashed border-slate-300 bg-white p-6 text-center">
      <p className="text-sm text-slate-500">La estructura todavía está vacía.</p>
    </div>
  ) : (
    renderGroup(items, null)
  );
}
