import { type FormEvent, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { useAdmin } from '../AdminContext';
import { HighlightedMapImage } from '../components/HighlightedMapImage';
import { PageError, PageLoading } from '../components/Common';
import { schemeCanRunSearchTests, type SearchTestResult } from '../types';

export function SearchTestsScreen() {
  const { schemes, loading, error, refresh, gateway, notify } = useAdmin();
  const [searchParams] = useSearchParams();
  const [result, setResult] = useState<SearchTestResult | null>(null);
  const [selectedMatch, setSelectedMatch] = useState(0);
  const [mapView, setMapView] = useState<'top' | 'front'>('top');

  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    try {
      const response = await gateway.searchTests(String(data.get('schemeId')), String(data.get('callNumber')));
      setResult(response.data);
      setSelectedMatch(0);
      setMapView('top');
    } catch (error) {
      notify(error instanceof Error ? error.message : 'No se pudo ejecutar la prueba.', 'error');
    }
  }

  if (loading) return <PageLoading label="Cargando esquemas…" />;
  if (error) return <PageError message={error} onRetry={refresh} />;
  const match = result?.matches[selectedMatch];
  const hasTop = Boolean(result?.maps.topViews.length);
  const hasFront = Boolean(result?.maps.frontViews.length);
  const searchableSchemes = schemes.filter(schemeCanRunSearchTests);
  const requestedSchemeId = searchParams.get('schemeId');
  const defaultSchemeId = requestedSchemeId && searchableSchemes.some((scheme) => scheme.id === requestedSchemeId)
    ? requestedSchemeId
    : searchableSchemes.find((scheme) => scheme.isActive)?.id ?? searchableSchemes[0]?.id;

  return (
    <div className="admin-content admin-content--wide">
      <header className="admin-page-heading"><div><h1>Pruebas de búsqueda</h1><p>Consulta esquemas con rangos parcial o completamente definidos.</p></div></header>

      <form className="admin-card admin-search-form" onSubmit={(event) => void search(event)}>
        <div className="admin-field"><label htmlFor="test-scheme">Esquema</label><select id="test-scheme" name="schemeId" defaultValue={defaultSchemeId} disabled={!searchableSchemes.length}>{searchableSchemes.map((scheme) => <option key={scheme.id} value={scheme.id}>{scheme.name}{scheme.isActive ? ' (activo)' : ''}</option>)}</select></div>
        <div className="admin-field admin-search-query"><label htmlFor="test-call-number">Signatura</label><input id="test-call-number" name="callNumber" placeholder="Ej. 515 A" required disabled={!searchableSchemes.length} /><button className="admin-button" type="submit" disabled={!searchableSchemes.length}>Buscar</button></div>
      </form>

      {!searchableSchemes.length ? <div className="admin-empty">No hay esquemas con rangos definidos.</div> : null}

      {!result ? <div className="admin-empty admin-search-empty">Ejecuta una búsqueda para ver las coincidencias y su recorrido.</div> : (
        <section className="admin-search-results" aria-live="polite">
          <div className="admin-search-summary"><strong>{result.matches.length} {result.matches.length === 1 ? 'ubicación encontrada' : 'ubicaciones encontradas'}</strong><span>{hasTop ? hasFront ? `${result.maps.frontViews.length} vistas frontales` : 'Vista superior; sin vista frontal' : 'Solo resultado textual'}</span></div>

          <div className="admin-search-layout">
            <div className="admin-search-visuals">
              <div className="admin-tabs" role="tablist" aria-label="Vistas del resultado">
                <button type="button" role="tab" className={mapView === 'top' ? 'is-active' : ''} aria-selected={mapView === 'top'} onClick={() => setMapView('top')}>Superior</button>
                <button type="button" role="tab" className={mapView === 'front' ? 'is-active' : ''} aria-selected={mapView === 'front'} onClick={() => setMapView('front')} disabled={!hasFront}>Frontal</button>
              </div>
              <div className="admin-search-canvas">
                {mapView === 'top' && hasTop ? result.maps.topViews.map((view) => <figure key={view.id}><figcaption>{view.name}</figcaption><HighlightedMapImage assetUrl={view.assetUrl} attribute="data-location-code" values={view.highlightLocationCodes} alt={`Vista superior ${view.name}`} /></figure>) : null}
                {mapView === 'front' && hasFront ? result.maps.frontViews.map((view) => <figure key={view.id}><figcaption>{view.name}</figcaption><HighlightedMapImage assetUrl={view.assetUrl} attribute="data-slot" values={view.highlightSlots} alt={`Vista frontal ${view.name}`} /></figure>) : null}
                {!hasTop && mapView === 'top' ? <div className="admin-empty"><strong>Resultado sin mapa</strong><span>La ruta textual está disponible en los detalles.</span></div> : null}
              </div>
            </div>

            <aside className="admin-search-details" aria-label="Detalles de búsqueda">
              <dl><div><dt>Consulta</dt><dd>{result.query}</dd></div><div><dt>Normalizada</dt><dd>{result.normalized}</dd></div><div><dt>Esquema</dt><dd>{result.schemeName}</dd></div><div><dt>Rango</dt><dd>{match ? `${match.rangeStart} a ${match.rangeEnd}` : 'Sin coincidencias'}</dd></div></dl>
              <div className="admin-search-matches">
                {result.matches.map((item, index) => <button className={index === selectedMatch ? 'is-selected' : ''} type="button" key={item.locationId} onClick={() => setSelectedMatch(index)} aria-pressed={index === selectedMatch}><strong>{item.name}</strong><span>{item.code}</span></button>)}
              </div>
              {match ? <div className="admin-text-route"><h2>Ruta textual</h2><ol>{match.route.map((item) => <li key={item.code}><span aria-hidden="true" /><div><strong>{item.name}</strong><small>{item.code}</small></div></li>)}</ol></div> : null}
            </aside>
          </div>
        </section>
      )}
    </div>
  );
}
