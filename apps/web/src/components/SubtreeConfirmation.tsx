import { useEffect, useRef } from 'react';
import type { SubtreePreview } from '@bjff/api-types';

export function SubtreeConfirmation({
  preview,
  busy,
  onConfirm,
  onCancel,
}: {
  preview: SubtreePreview;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  useEffect(() => cancelRef.current?.focus(), []);

  return (
    <div
      role="alertdialog"
      aria-labelledby="subtree-title"
      className="rounded border border-red-300 p-4"
    >
      <h3 id="subtree-title" className="font-semibold">
        Eliminar {preview.root.name}
      </h3>
      <p className="mt-1 text-sm">
        Se eliminarán {preview.descendantCount + 1} elementos del subárbol. Esta acción no
        se puede deshacer.
      </p>
      <ul className="mt-2 max-h-40 overflow-auto text-sm">
        {preview.items.map((item) => (
          <li key={item.id}>
            {item.name} · {item.role}
          </li>
        ))}
      </ul>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={onConfirm}
          className="rounded bg-red-700 px-3 py-2 text-white"
        >
          {busy ? 'Eliminando…' : 'Confirmar eliminación'}
        </button>
        <button
          ref={cancelRef}
          type="button"
          disabled={busy}
          onClick={onCancel}
          className="rounded border px-3 py-2"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
