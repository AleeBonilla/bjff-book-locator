import { NavLink, Outlet, useParams } from 'react-router-dom';

import { useAdminScheme } from '../AdminContext';
import { schemeCanUseMapsAndRanges, type Scheme } from '../types';
import { PageError, PageLoading } from './Common';

const steps = [
  { number: '01', label: 'Esquema', path: 'details', danger: false },
  { number: '02', label: 'Niveles', path: 'levels', danger: false },
  { number: '03', label: 'Ubicaciones', path: 'locations', danger: false },
  { number: '04', label: 'Mapas', path: 'maps', danger: false },
  { number: '05', label: 'Rangos', path: 'ranges', danger: false },
  { number: '06', label: 'Revisar', path: 'review', danger: false },
  { number: '07', label: 'Zona de riesgo', path: 'danger', danger: true },
] as const;

function enabledStep(scheme: Scheme, path: string) {
  if (path === 'details' || path === 'levels' || path === 'danger') return true;
  if (path === 'locations') return scheme.status !== 'DRAFT';
  if (path === 'maps' || path === 'ranges' || path === 'review') {
    return schemeCanUseMapsAndRanges(scheme);
  }
  return false;
}

export interface SchemeWorkspaceContext {
  scheme: Scheme;
}

export function WorkflowSteps({ scheme }: { scheme: Scheme | null }) {
  return (
    <nav className="admin-workflow" aria-label="Progreso de configuración">
      {steps.map((step) => {
        const enabled = scheme ? enabledStep(scheme, step.path) : step.path === 'details';
        if (!scheme || !enabled) {
          return (
            <span className={`admin-workflow__step is-disabled${step.danger ? ' is-danger' : ''}`} key={step.path} aria-disabled="true">
              <span>{step.number}</span>
              <strong>{step.label}</strong>
            </span>
          );
        }
        return (
          <NavLink className={`admin-workflow__step${step.danger ? ' is-danger' : ''}`} key={step.path} to={step.path}>
            <span>{step.number}</span>
            <strong>{step.label}</strong>
          </NavLink>
        );
      })}
    </nav>
  );
}

export function WorkflowLayout() {
  const { schemeId } = useParams();
  const { scheme, loading, error } = useAdminScheme(schemeId);

  if (loading && !scheme) return <PageLoading label="Cargando esquema…" />;
  if (error || !scheme) return <PageError message={error || 'El esquema no existe.'} />;

  return (
    <div className="admin-content admin-content--wide">
      <div className="admin-workspace-heading">
        <div>
          <p className="admin-eyebrow">Esquema {scheme.id}</p>
          <h1>{scheme.name}</h1>
        </div>
        <NavLink className="admin-back" to="/admin">Volver a esquemas</NavLink>
      </div>
      <WorkflowSteps scheme={scheme} />
      <Outlet context={{ scheme } satisfies SchemeWorkspaceContext} />
    </div>
  );
}
