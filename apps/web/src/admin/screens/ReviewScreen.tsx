import { useEffect, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';

import { useAdmin } from '../AdminContext';
import { PageLoading } from '../components/Common';
import type { SchemeWorkspaceContext } from '../components/WorkflowLayout';
import type { SchemeReview } from '../types';

export function ReviewScreen() {
  const { scheme } = useOutletContext<SchemeWorkspaceContext>();
  const { gateway, commit, revision } = useAdmin();
  const [review, setReview] = useState<SchemeReview | null>(null);
  const [activate, setActivate] = useState(true);

  useEffect(() => {
    let active = true;
    void gateway.reviewScheme(scheme.id).then(({ data }) => {
      if (active) setReview(data);
    });
    return () => {
      active = false;
    };
  }, [gateway, revision, scheme.id]);

  async function publish() {
    try {
      await commit(gateway.publishScheme(scheme.id, activate), activate ? 'Esquema publicado y activado.' : 'Esquema publicado.');
    } catch {
      // El gateway ya presentó el error funcional.
    }
  }

  async function activatePublished() {
    try {
      await commit(gateway.activateScheme(scheme.id), 'Esquema activado.');
    } catch {
      // El gateway ya presentó el error funcional.
    }
  }

  if (!review) return <PageLoading label="Calculando revisión…" />;

  return (
    <section className="admin-stage" aria-labelledby="review-title">
      <div className="admin-stage-heading">
        <div><h2 id="review-title">Revisar y publicar</h2><p>La publicación habilita este esquema para la búsqueda pública.</p></div>
        <div className="admin-stage-actions">
          <Link className="admin-button admin-button--quiet" to={`/admin/search-tests?schemeId=${encodeURIComponent(scheme.id)}`}>Probar búsqueda</Link>
          <span className={`admin-readiness ${review.publishable || scheme.publishedAt ? 'is-ready' : ''}`}>{scheme.publishedAt ? 'Publicado' : review.publishable ? 'Listo' : 'Incompleto'}</span>
        </div>
      </div>

      <div className="admin-review-grid">
        <article className="admin-card admin-review-check">
          <div><strong>Niveles</strong><span>{review.levelCount} definidos</span></div>
          <Link to="../levels">Ver</Link>
        </article>
        <article className="admin-card admin-review-check">
          <div><strong>Ubicaciones</strong><span>{review.locationCount} confirmadas</span></div>
          <Link to="../locations">Ver</Link>
        </article>
        <article className={`admin-card admin-review-check ${review.mapValidation.ready ? '' : 'is-pending'}`}>
          <div><strong>Mapas</strong><span>{review.mapValidation.top.missingLocationCodes.length ? `${review.mapValidation.top.missingLocationCodes.length} ubicaciones sin cobertura` : 'Cobertura superior completa'}</span></div>
          <Link to="../maps">{review.mapValidation.ready ? 'Ver' : 'Completar'}</Link>
        </article>
        <article className={`admin-card admin-review-check ${review.missingRangeLocationIds.length ? 'is-pending' : ''}`}>
          <div><strong>Rangos</strong><span>{review.assignedRangeCount} de {review.terminalCount}</span></div>
          <Link to="../ranges">{review.missingRangeLocationIds.length ? 'Completar' : 'Ver'}</Link>
        </article>
      </div>

      <section className="admin-card admin-publish-panel" aria-labelledby="publish-title">
        <div>
          <h3 id="publish-title">Publicación</h3>
          {scheme.publishedAt ? (
            <p>Publicado el {new Intl.DateTimeFormat('es-CR', { dateStyle: 'long', timeStyle: 'short' }).format(new Date(scheme.publishedAt))}.</p>
          ) : review.blockers.length ? (
            <ul>{review.blockers.map((blocker) => <li key={blocker.code}>{blocker.message}</li>)}</ul>
          ) : <p>El esquema cumple los requisitos de publicación.</p>}
        </div>

        {scheme.publishedAt ? (
          scheme.isActive
            ? <span className="admin-active-badge">Esquema activo</span>
            : <button className="admin-button" type="button" onClick={() => void activatePublished()}>Activar esquema</button>
        ) : (
          <div className="admin-publish-actions">
            <label><input type="checkbox" checked={activate} onChange={(event) => setActivate(event.target.checked)} />Activar al publicar</label>
            <button className="admin-button" type="button" disabled={!review.publishable} onClick={() => void publish()}>{activate ? 'Publicar y activar' : 'Publicar esquema'}</button>
          </div>
        )}
      </section>
    </section>
  );
}
