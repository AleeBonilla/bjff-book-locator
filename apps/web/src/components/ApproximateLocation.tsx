import type { PublicSearchResult } from '@bjff/api-types';

export function ApproximateLocation({ result }: { result: PublicSearchResult }) {
  if (result.status === 'NOT_FOUND') {
    return (
      <section
        className="public-search-result public-search-result-empty"
        aria-live="polite"
      >
        <p className="public-search-result-label">Ubicación aproximada</p>
        <h2>No encontramos una ubicación publicada</h2>
        <p>{result.message}</p>
      </section>
    );
  }

  return (
    <section className="public-search-result" aria-live="polite">
      <p className="public-search-result-label">Ubicación aproximada</p>
      <h2>
        {result.locations.length === 1
          ? 'Dirigite a esta ubicación'
          : 'Ubicaciones posibles'}
      </h2>
      <ul className="public-location-list">
        {result.locations.map((location) => (
          <li key={`${location.path}:${location.mapElementId ?? ''}`}>
            <LocationIcon />
            <span>
              <strong>{location.path}</strong>
              {location.mapElementId ? (
                <small>Referencia: {location.mapElementId}</small>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
      <p className="public-search-note">
        El resultado es aproximado. Consultá al personal de la biblioteca si necesitás
        ayuda.
      </p>
    </section>
  );
}

function LocationIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7Zm0 10.1A3.1 3.1 0 1 1 12 6a3.1 3.1 0 0 1 0 6.1Z" />
    </svg>
  );
}
