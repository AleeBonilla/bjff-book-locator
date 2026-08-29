import { useEffect, useState } from 'react';

import { highlightSvg, sanitizeSvgForPreview, svgDataUrl } from '../svg';

export function HighlightedMapImage({
  assetUrl,
  attribute,
  values,
  alt,
}: {
  assetUrl: string;
  attribute: 'data-location-code' | 'data-slot';
  values: Array<string | number>;
  alt: string;
}) {
  const [source, setSource] = useState(assetUrl.startsWith('data:') ? assetUrl : '');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    if (assetUrl.startsWith('data:')) {
      setSource(assetUrl);
      setError('');
      return () => {
        active = false;
      };
    }

    setSource('');
    setError('');
    void fetch(assetUrl)
      .then(async (response) => {
        if (!response.ok) throw new Error('No se pudo cargar el mapa.');
        return response.text();
      })
      .then((svg) => {
        if (!active) return;
        const sanitized = sanitizeSvgForPreview(svg);
        setSource(svgDataUrl(highlightSvg(sanitized, attribute, values)));
      })
      .catch(() => {
        if (active) setError('No se pudo mostrar este mapa.');
      });

    return () => {
      active = false;
    };
  }, [assetUrl, attribute, values]);

  if (error) return <div className="admin-empty" role="alert">{error}</div>;
  if (!source) return <p className="admin-state" role="status">Cargando mapa…</p>;
  return <img src={source} alt={alt} />;
}
