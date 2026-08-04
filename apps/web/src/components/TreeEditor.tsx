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
  onSelect,
  onReorder,
  onDelete,
}: {
  items: TreeEditorItem[];
  editable: boolean;
  selectedId?: number | null;
  onSelect?: (id: number) => void;
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
    <ul className={parentId === null ? 'space-y-2' : 'mt-2 ml-6 space-y-2'}>
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
            className={`flex flex-wrap items-center gap-2 rounded border p-2 ${
              selectedId === item.id
                ? 'border-sky-600 bg-sky-50 dark:bg-sky-950'
                : 'border-slate-200 dark:border-slate-800'
            }`}
          >
            <button
              type="button"
              onClick={() => onSelect?.(item.id)}
              className="text-left font-medium underline-offset-4 hover:underline"
            >
              {item.name}
            </button>
            <span className="rounded bg-slate-100 px-2 py-0.5 text-xs dark:bg-slate-800">
              {item.role === 'POSITION' ? 'Posición' : 'Contenedor'}
            </span>
            {!item.enabled && (
              <span className="text-xs text-amber-700">Deshabilitado</span>
            )}
            {item.secondary && (
              <span className="text-xs text-slate-500">{item.secondary}</span>
            )}
            {editable && onReorder && (
              <span className="ml-auto flex gap-1">
                <button
                  type="button"
                  disabled={index === 0 || busy !== null}
                  onClick={() => void move(group, parentId, index, -1)}
                  aria-label={`Subir ${item.name}`}
                  className="rounded border px-2 disabled:opacity-40"
                >
                  ↑
                </button>
                <button
                  type="button"
                  disabled={index === group.length - 1 || busy !== null}
                  onClick={() => void move(group, parentId, index, 1)}
                  aria-label={`Bajar ${item.name}`}
                  className="rounded border px-2 disabled:opacity-40"
                >
                  ↓
                </button>
                {onDelete && (
                  <button
                    type="button"
                    onClick={() => onDelete(item.id)}
                    className="rounded border border-red-300 px-2 text-red-700"
                  >
                    Eliminar
                  </button>
                )}
              </span>
            )}
          </div>
          {item.children.length > 0 && renderGroup(item.children, item.id)}
        </li>
      ))}
    </ul>
  );

  return items.length === 0 ? (
    <p className="text-sm text-slate-500">El árbol todavía está vacío.</p>
  ) : (
    renderGroup(items, null)
  );
}
