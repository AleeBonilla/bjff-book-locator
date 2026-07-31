import type { CapacityUnit, DistributionValues } from '@bjff/api-types';
import { FormEvent, useState } from 'react';

export function DistributionSettingsForm({
  initial,
  busy,
  inheritance,
  onSave,
  onClear,
}: {
  initial: DistributionValues;
  busy: boolean;
  inheritance: 'CONTAINER' | 'POSITION';
  onSave: (values: DistributionValues) => Promise<void>;
  onClear: () => Promise<void>;
}) {
  const [capacity, setCapacity] = useState(initial.capacity?.value.toString() ?? '');
  const [unit, setUnit] = useState<CapacityUnit>(initial.capacity?.unit ?? 'BOOKS');
  const [ratio, setRatio] = useState(initial.targetFillRatio?.toString() ?? '');
  const [overflow, setOverflow] = useState(
    initial.allowOverflow === null ? '' : String(initial.allowOverflow),
  );

  async function submit(event: FormEvent): Promise<void> {
    event.preventDefault();
    await onSave({
      capacity: capacity === '' ? null : { value: Number(capacity), unit },
      targetFillRatio: ratio === '' ? null : Number(ratio),
      allowOverflow: overflow === '' ? null : overflow === 'true',
    });
  }

  return (
    <form
      onSubmit={(event) => void submit(event)}
      className="mt-4 grid gap-3 rounded border p-4 md:grid-cols-2"
    >
      <h3 className="font-semibold md:col-span-2">Configuración previa</h3>
      <p className="text-xs text-slate-500 md:col-span-2">
        {inheritance === 'CONTAINER'
          ? 'El servidor marcará estos valores como heredables a las posiciones descendientes.'
          : 'Estos valores se aplican únicamente a esta posición.'}
      </p>
      <label className="grid gap-1 text-sm">
        Capacidad
        <input
          type="number"
          min="0.01"
          step="0.01"
          value={capacity}
          onChange={(event) => setCapacity(event.target.value)}
          className="rounded border px-3 py-2"
        />
      </label>
      <label className="grid gap-1 text-sm">
        Unidad
        <select
          value={unit}
          disabled={capacity === ''}
          onChange={(event) => setUnit(event.target.value as CapacityUnit)}
          className="rounded border px-3 py-2"
        >
          <option value="BOOKS">Libros</option>
          <option value="CENTIMETERS">Centímetros</option>
          <option value="WEIGHT">Peso</option>
        </select>
      </label>
      <label className="grid gap-1 text-sm">
        Objetivo de llenado
        <input
          type="number"
          min="0.0001"
          max="1"
          step="0.0001"
          value={ratio}
          onChange={(event) => setRatio(event.target.value)}
          className="rounded border px-3 py-2"
        />
      </label>
      <label className="grid gap-1 text-sm">
        Overflow
        <select
          value={overflow}
          onChange={(event) => setOverflow(event.target.value)}
          className="rounded border px-3 py-2"
        >
          <option value="">Sin definir</option>
          <option value="true">Permitido</option>
          <option value="false">No permitido</option>
        </select>
      </label>
      <div className="flex gap-2 md:col-span-2">
        <button disabled={busy} className="rounded bg-sky-700 px-3 py-2 text-white">
          Guardar
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void onClear()}
          className="rounded border px-3 py-2"
        >
          Limpiar valores
        </button>
      </div>
    </form>
  );
}
