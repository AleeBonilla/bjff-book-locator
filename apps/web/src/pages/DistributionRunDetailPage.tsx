import type {
  DistributionRange,
  DistributionComparison,
  DistributionRunDetail,
  PublicSearchResult,
} from '@bjff/api-types';
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';

import { ApiRequestError, api } from '../api/client.js';
import { ApproximateLocation } from '../components/ApproximateLocation.js';
import { DistributionWarnings } from '../components/DistributionWarnings.js';

export function DistributionRunDetailPage() {
  const runId = Number(useParams().id);
  const [run, setRun] = useState<DistributionRunDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewAccepted, setPreviewAccepted] = useState(false);
  const [unassignedAccepted, setUnassignedAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [testCode, setTestCode] = useState('');
  const [testResult, setTestResult] = useState<PublicSearchResult | null>(null);
  const [comparison, setComparison] = useState<DistributionComparison | null>(null);

  useEffect(() => {
    void api
      .distributionRun(runId)
      .then(setRun)
      .catch(() => setError('No se pudo obtener la corrida.'));
  }, [runId]);

  useEffect(() => {
    if (!run?.basedOnDistributionRunId) return;
    void api
      .distributionComparison(run.distributionRunId)
      .then(setComparison)
      .catch(() => setError('No se pudo comparar con la corrida base.'));
  }, [run]);

  if (!run) return <p role={error ? 'alert' : 'status'}>{error ?? 'Cargando...'}</p>;

  return (
    <section>
      <Link to="/esquemas/distribuciones" className="back-link">
        Volver a distribuciones
      </Link>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-[#002855]">
            Corrida {run.distributionRunId}
          </h2>
          <p className="helper-text mt-1">
            Revisión {run.revision}. Ubicación siempre aproximada.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {run.status === 'DONE' && (
            <Link
              to={`/esquemas/distribuciones/nueva?base=${run.distributionRunId}`}
              className="button-secondary"
            >
              Crear derivada
            </Link>
          )}
          {(run.status === 'DONE' || run.status === 'ERROR') && !run.isPublished && (
            <Link
              to={`/esquemas/distribuciones/${run.distributionRunId}/editar`}
              className="button-secondary"
            >
              Editar y recalcular
            </Link>
          )}
          <span className="status-pill">{run.status}</span>
        </div>
      </div>

      {error ? (
        <p role="alert" className="mt-4 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <Counter label="Registros" value={run.counters.bookCount} />
        <Counter label="Posiciones" value={run.counters.positionCount} />
        <Counter label="Sin asignar" value={run.counters.unassignedCount} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="surface p-5">
          <h3 className="font-semibold text-[#002855]">Posiciones congeladas</h3>
          <ol className="mt-3 grid gap-2 text-sm">
            {run.positions.map((position) => (
              <li key={position.locationId}>
                {position.positionSequence}. {position.path}
              </li>
            ))}
          </ol>
        </div>
        <div className="surface p-5">
          <h3 className="font-semibold text-[#002855]">Rangos aproximados</h3>
          <ol className="mt-3 grid gap-3 text-sm">
            {run.ranges.map((range) => (
              <li key={range.distributionRangeId}>
                <strong>{range.path}</strong>
                <div className="helper-text">
                  {range.startCode ?? 'Inicio global'} hasta{' '}
                  {range.endCode ?? 'Final global'}
                </div>
                {run.status === 'DONE' && !run.isPublished ? (
                  <RangeReview
                    range={range}
                    revision={run.revision}
                    runId={run.distributionRunId}
                    onSaved={setRun}
                    onError={setError}
                  />
                ) : range.reviewNotes ? (
                  <p className="helper-text mt-1">Nota: {range.reviewNotes}</p>
                ) : null}
              </li>
            ))}
          </ol>
        </div>
      </div>

      <div className="mt-6">
        <DistributionWarnings warnings={run.warnings} />
      </div>

      {comparison ? <ComparisonSummary comparison={comparison} /> : null}

      {run.status === 'DONE' && (
        <TestSearch
          runId={run.distributionRunId}
          busy={busy}
          setBusy={setBusy}
          code={testCode}
          setCode={setTestCode}
          result={testResult}
          setResult={setTestResult}
          setError={setError}
        />
      )}

      {run.status === 'DONE' && !run.isPublished && (
        <div className="surface mt-6 p-5">
          <h3 className="font-semibold text-[#002855]">Publicar esta versión</h3>
          <label className="checkbox-row mt-3 items-start text-sm">
            <input
              type="checkbox"
              checked={previewAccepted}
              onChange={(event) => setPreviewAccepted(event.target.checked)}
            />
            Revisé la vista previa y acepto usar esta distribución aproximada.
          </label>
          {run.warnings.unassignedCount > 0 && (
            <label className="checkbox-row mt-3 items-start text-sm">
              <input
                type="checkbox"
                checked={unassignedAccepted}
                onChange={(event) => setUnassignedAccepted(event.target.checked)}
              />
              Acepto publicar con {run.warnings.unassignedCount} registros sin asignar.
            </label>
          )}
          <button
            type="button"
            disabled={
              busy ||
              !previewAccepted ||
              (run.warnings.unassignedCount > 0 && !unassignedAccepted)
            }
            className="button-primary mt-4"
            onClick={() => {
              setBusy(true);
              setError(null);
              void api
                .publishDistributionRun(run.distributionRunId, {
                  expectedRevision: run.revision,
                  previewAccepted,
                  unassignedAccepted,
                })
                .then(setRun)
                .catch((cause) =>
                  setError(
                    cause instanceof ApiRequestError
                      ? cause.message
                      : 'No se pudo publicar la corrida.',
                  ),
                )
                .finally(() => setBusy(false));
            }}
          >
            {busy ? 'Publicando...' : 'Publicar distribución'}
          </button>
        </div>
      )}
    </section>
  );
}

function TestSearch({
  runId,
  busy,
  setBusy,
  code,
  setCode,
  result,
  setResult,
  setError,
}: {
  runId: number;
  busy: boolean;
  setBusy: (value: boolean) => void;
  code: string;
  setCode: (value: string) => void;
  result: PublicSearchResult | null;
  setResult: (value: PublicSearchResult | null) => void;
  setError: (value: string | null) => void;
}) {
  const [validationError, setValidationError] = useState<string | null>(null);

  return (
    <div className="surface mt-6 p-5">
      <h3 className="font-semibold text-[#002855]">Probar una búsqueda</h3>
      <p className="helper-text mt-1">
        Consulta esta vista previa aunque todavía no esté publicada.
      </p>
      <form
        className="mt-3 flex flex-wrap gap-2"
        noValidate
        onSubmit={(event: FormEvent) => {
          event.preventDefault();
          const trimmedCode = code.trim();
          setResult(null);
          setValidationError(null);
          if (!trimmedCode) {
            setValidationError('Escribí un código de clasificación.');
            return;
          }
          if (trimmedCode.length > 60) {
            setValidationError(
              'El código de clasificación no puede superar 60 caracteres.',
            );
            return;
          }
          setBusy(true);
          setError(null);
          void api
            .testDistributionSearch(runId, trimmedCode)
            .then(setResult)
            .catch((cause) => {
              if (
                cause instanceof ApiRequestError &&
                cause.code === 'VALIDATION_FAILED'
              ) {
                setValidationError(cause.message);
                return;
              }
              setError(
                cause instanceof ApiRequestError
                  ? cause.message
                  : 'No se pudo probar la búsqueda.',
              );
            })
            .finally(() => setBusy(false));
        }}
      >
        <label className="min-w-64 flex-1 text-sm">
          <span className="sr-only">Código de clasificación</span>
          <input
            value={code}
            onChange={(event) => {
              setCode(event.target.value);
              setValidationError(null);
              setResult(null);
            }}
            placeholder="Código de clasificación"
            maxLength={60}
            required
            aria-invalid={validationError ? true : undefined}
            aria-describedby="test-search-help test-search-error"
          />
        </label>
        <button type="submit" className="button-secondary" disabled={busy}>
          Probar
        </button>
      </form>
      <p id="test-search-help" className="helper-text mt-2">
        Usá el código completo de la etiqueta, incluidos letras, puntos y números.
      </p>
      {validationError ? (
        <p id="test-search-error" role="alert" className="mt-2 text-sm text-red-700">
          {validationError}
        </p>
      ) : null}
      {result ? (
        <div className="mt-4">
          <ApproximateLocation result={result} />
        </div>
      ) : null}
    </div>
  );
}

function RangeReview({
  range,
  runId,
  revision,
  onSaved,
  onError,
}: {
  range: DistributionRange;
  runId: number;
  revision: number;
  onSaved: (run: DistributionRunDetail) => void;
  onError: (message: string | null) => void;
}) {
  const [notes, setNotes] = useState(range.reviewNotes ?? '');
  const [busy, setBusy] = useState(false);

  return (
    <div className="mt-2 grid gap-2">
      <label className="grid gap-1 text-xs">
        Nota de revisión opcional
        <textarea
          rows={2}
          maxLength={1000}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
        />
      </label>
      <button
        type="button"
        className="button-secondary justify-self-start"
        disabled={busy}
        onClick={() => {
          setBusy(true);
          onError(null);
          void api
            .reviewDistributionRange(runId, range.distributionRangeId, {
              expectedRevision: revision,
              notes: notes.trim() || null,
            })
            .then(onSaved)
            .catch((cause) =>
              onError(
                cause instanceof ApiRequestError
                  ? cause.message
                  : 'No se pudo guardar la revisión.',
              ),
            )
            .finally(() => setBusy(false));
        }}
      >
        {busy ? 'Guardando...' : notes.trim() ? 'Guardar nota' : 'Quitar revisión'}
      </button>
    </div>
  );
}

function Counter({ label, value }: { label: string; value: number }) {
  return (
    <div className="surface p-4">
      <span className="helper-text">{label}</span>
      <strong className="mt-1 block text-2xl text-[#002855]">{value}</strong>
    </div>
  );
}

function ComparisonSummary({ comparison }: { comparison: DistributionComparison }) {
  const counters = [
    ['Asignados', comparison.counterChanges.assigned],
    ['Sin asignar', comparison.counterChanges.unassigned],
    ['Posiciones vacías', comparison.counterChanges.emptyPositions],
    ['Sobrecargas', comparison.counterChanges.overloadedPositions],
    ['Claves divididas', comparison.counterChanges.splitKeys],
  ] as const;

  return (
    <section className="surface mt-6 p-5">
      <h3 className="font-semibold text-[#002855]">
        Cambios contra la corrida {comparison.againstRunId}
      </h3>
      <div className="mt-3 grid gap-3 sm:grid-cols-5">
        {counters.map(([label, value]) => (
          <div key={label} className="rounded border border-slate-200 p-3">
            <span className="helper-text">{label}</span>
            <strong className="mt-1 block text-lg text-[#002855]">
              {value > 0 ? `+${value}` : value}
            </strong>
          </div>
        ))}
      </div>
      <div className="mt-4 grid gap-2 text-sm">
        {comparison.rangeChanges.map((change) => (
          <div key={change.locationId} className="rounded border border-slate-200 p-3">
            <strong>{change.path}</strong>
            <p className="helper-text mt-1">
              Antes: {formatBoundary(change.before?.startCode, 'Inicio global')} hasta{' '}
              {formatBoundary(change.before?.endCode, 'Final global')}
            </p>
            <p className="helper-text">
              Ahora: {formatBoundary(change.after?.startCode, 'Inicio global')} hasta{' '}
              {formatBoundary(change.after?.endCode, 'Final global')}
            </p>
          </div>
        ))}
        {comparison.rangeChanges.length === 0 ? (
          <p className="helper-text">No cambiaron las fronteras legibles.</p>
        ) : null}
      </div>
    </section>
  );
}

function formatBoundary(value: string | null | undefined, fallback: string): string {
  return value ?? fallback;
}
