import type {
  AnchorInput,
  CreateDistributionRunRequest,
  DistributionRunDetail,
  ManualRangeInput,
  ResumenDeCarga,
  RunDefaults,
  Scheme,
} from '@bjff/api-types';
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { ApiRequestError, api } from '../api/client.js';
import { AnchorEditor } from '../components/AnchorEditor.js';
import { DistributionRunForm } from '../components/DistributionRunForm.js';
import { ManualRangeEditor } from '../components/ManualRangeEditor.js';

export function DistributionRunEditorPage() {
  const runId = Number(useParams().id);
  return Number.isInteger(runId) && runId > 0 ? (
    <RecalculationEditor runId={runId} />
  ) : (
    <CreationEditor />
  );
}

function CreationEditor() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const baseRunId = Number(searchParams.get('base'));
  const derives = Number.isInteger(baseRunId) && baseRunId > 0;
  const [schemes, setSchemes] = useState<Scheme[]>([]);
  const [loads, setLoads] = useState<ResumenDeCarga[]>([]);
  const [initialCommand, setInitialCommand] =
    useState<CreateDistributionRunRequest | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void Promise.all([
      api.schemes(),
      api.loads(),
      derives ? api.distributionDerivationTemplate(baseRunId) : Promise.resolve(null),
    ])
      .then(([schemePage, loadPage, template]) => {
        setSchemes(
          schemePage.items.filter(
            (scheme) => scheme.availableForNewRun && scheme.enabled,
          ),
        );
        setLoads(loadPage.items.filter((load) => load.status === 'DONE'));
        if (template) {
          setInitialCommand({
            schemeId: template.schemeId,
            collectionLoadId: template.suggestedCollectionLoadId,
            basedOnDistributionRunId: template.basedOnDistributionRunId,
            strategy: template.strategy,
            defaults: template.defaults,
            anchors: template.anchors,
            manualRanges: template.manualRanges,
          });
        }
      })
      .catch(() => setError('No se pudieron cargar las opciones.'));
  }, [baseRunId, derives]);

  return (
    <section>
      <BackLink />
      <h2 className="mt-4 text-2xl font-semibold text-[#002855]">
        {derives ? `Derivar corrida ${baseRunId}` : 'Nueva corrida'}
      </h2>
      <p className="helper-text mt-1 mb-5">
        {derives
          ? 'La plantilla contiene solo entradas editables. Podés elegir otra carga antes de calcular.'
          : 'Seleccioná las entradas y obtené una vista previa completa y reproducible.'}
      </p>
      <ErrorMessage error={error} />
      {(!derives || initialCommand) && (
        <DistributionRunForm
          key={initialCommand?.basedOnDistributionRunId ?? 'new'}
          schemes={schemes}
          loads={loads}
          busy={busy}
          initialCommand={initialCommand ?? undefined}
          schemeLocked={derives}
          onSubmit={async (command) => {
            setBusy(true);
            setError(null);
            try {
              const run = await api.createDistributionRun(command);
              navigate(`/esquemas/distribuciones/${run.distributionRunId}`);
            } catch (cause) {
              setError(
                cause instanceof ApiRequestError
                  ? cause.message
                  : 'No se pudo calcular la corrida.',
              );
            } finally {
              setBusy(false);
            }
          }}
        />
      )}
    </section>
  );
}

function RecalculationEditor({ runId }: { runId: number }) {
  const navigate = useNavigate();
  const [run, setRun] = useState<DistributionRunDetail | null>(null);
  const [defaults, setDefaults] = useState<RunDefaults | null>(null);
  const [targetFillRatio, setTargetFillRatio] = useState('');
  const [anchors, setAnchors] = useState<AnchorInput[]>([]);
  const [manualRanges, setManualRanges] = useState<ManualRangeInput[]>([]);
  const [rebuildSnapshot, setRebuildSnapshot] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void api
      .distributionRun(runId)
      .then((loaded) => {
        setRun(loaded);
        setDefaults(loaded.defaults);
        setTargetFillRatio(String(loaded.defaults.targetFillRatio));
        setAnchors(
          loaded.anchors.map(({ locationId, boundaryCode }) => ({
            locationId,
            boundaryCode,
          })),
        );
        setManualRanges(
          loaded.strategy === 'MANUAL'
            ? loaded.ranges.map(({ locationId, startCode, endCode }) => ({
                locationId,
                startCode,
                endCode,
              }))
            : [],
        );
      })
      .catch(() => setError('No se pudo cargar la corrida.'));
  }, [runId]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!run || !defaults || targetFillRatio === '') return;
    setBusy(true);
    setError(null);
    try {
      const updated = await api.recalculateDistributionRun(runId, {
        expectedRevision: run.revision,
        rebuildSnapshot,
        defaults: { ...defaults, targetFillRatio: Number(targetFillRatio) },
        anchors,
        manualRanges,
      });
      navigate(`/esquemas/distribuciones/${updated.distributionRunId}`);
    } catch (cause) {
      if (cause instanceof ApiRequestError && cause.code === 'RUN_VERSION_CONFLICT') {
        setError(
          'La corrida cambió en otra pantalla. Actualizamos la revisión; tus campos siguen aquí para que los revisés y reenviés.',
        );
        try {
          setRun(await api.distributionRun(runId));
        } catch {
          setError('La corrida cambió y no se pudo recuperar la revisión vigente.');
        }
      } else {
        setError(
          cause instanceof ApiRequestError
            ? cause.message
            : 'No se pudo recalcular la corrida.',
        );
      }
    } finally {
      setBusy(false);
    }
  }

  if (!run || !defaults) {
    return <p role="status">{error ?? 'Cargando...'}</p>;
  }

  return (
    <section>
      <Link to={`/esquemas/distribuciones/${runId}`} className="back-link">
        Volver al detalle
      </Link>
      <h2 className="mt-4 text-2xl font-semibold text-[#002855]">
        Recalcular corrida {runId}
      </h2>
      <p className="helper-text mt-1 mb-5">
        Revisión vigente {run.revision}. El resultado anterior solo se sustituye si el
        cálculo completo termina bien.
      </p>
      <ErrorMessage error={error} />
      <form onSubmit={(event) => void submit(event)}>
        <div className="surface grid gap-4 p-5 md:grid-cols-2">
          <label className="grid gap-1 text-sm">
            Capacidad predeterminada
            <input
              data-testid="capacity-value"
              type="number"
              min="0.01"
              step="0.01"
              value={defaults.capacity?.value ?? ''}
              onChange={(event) =>
                setDefaults({
                  ...defaults,
                  capacity: event.target.value
                    ? {
                        value: Number(event.target.value),
                        unit: defaults.capacity?.unit ?? 'BOOKS',
                      }
                    : null,
                })
              }
            />
          </label>
          <label className="grid gap-1 text-sm">
            Unidad predeterminada
            <select
              data-testid="capacity-unit"
              value={defaults.capacity?.unit ?? 'BOOKS'}
              disabled={run.strategy === 'CAPACITY' || defaults.capacity === null}
              onChange={(event) =>
                setDefaults({
                  ...defaults,
                  capacity:
                    defaults.capacity === null
                      ? null
                      : {
                          ...defaults.capacity,
                          unit: event.target.value as 'BOOKS' | 'CENTIMETERS' | 'WEIGHT',
                        },
                })
              }
            >
              {run.strategy !== 'WEIGHTED' && <option value="BOOKS">Libros</option>}
              {run.strategy !== 'CAPACITY' && (
                <option value="CENTIMETERS">Centímetros</option>
              )}
              {run.strategy !== 'CAPACITY' && (
                <option value="WEIGHT">Peso relativo</option>
              )}
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            Objetivo de llenado
            <input
              data-testid="target-fill-ratio"
              type="number"
              min="0.0001"
              max="1"
              step="0.0001"
              required
              value={targetFillRatio}
              onChange={(event) => setTargetFillRatio(event.target.value)}
            />
            <span className="helper-text">1 equivale al 100 % de la capacidad.</span>
          </label>
          <label className="setting-toggle text-sm">
            <span className="setting-toggle-copy">
              <strong>Permitir superar el objetivo aproximado</strong>
              <small>
                Mantiene junta una misma clave aunque exceda el objetivo calculado.
              </small>
            </span>
            <input
              type="checkbox"
              checked={defaults.allowOverflow}
              onChange={(event) =>
                setDefaults({ ...defaults, allowOverflow: event.target.checked })
              }
            />
          </label>
          <label className="setting-toggle text-sm md:col-span-2">
            <span className="setting-toggle-copy">
              <strong>Reconstruir posiciones desde el esquema vigente</strong>
              <small>
                Vuelve a resolver el orden y la configuración antes de calcular.
              </small>
            </span>
            <input
              type="checkbox"
              checked={rebuildSnapshot}
              onChange={(event) => setRebuildSnapshot(event.target.checked)}
            />
          </label>
        </div>

        {(run.strategy === 'HYBRID' || run.strategy === 'ANCHORED') && (
          <AnchorEditor
            positions={run.positions}
            anchors={anchors}
            onChange={setAnchors}
          />
        )}
        {run.strategy === 'MANUAL' && (
          <ManualRangeEditor
            positions={run.positions}
            ranges={manualRanges}
            onChange={setManualRanges}
          />
        )}

        <button type="submit" disabled={busy} className="button-primary mt-5">
          {busy ? 'Recalculando...' : 'Recalcular vista previa'}
        </button>
      </form>
    </section>
  );
}

function BackLink() {
  return (
    <Link to="/esquemas/distribuciones" className="back-link">
      Volver a distribuciones
    </Link>
  );
}

function ErrorMessage({ error }: { error: string | null }) {
  return error ? (
    <p role="alert" className="mb-4 text-sm text-red-700">
      {error}
    </p>
  ) : null;
}
