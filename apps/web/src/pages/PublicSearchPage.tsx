import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import type { PublicSearchResult } from '@bjff/api-types';

import { api, ApiRequestError } from '../api/client.js';
import { ApproximateLocation } from '../components/ApproximateLocation.js';
import { BrandLogo } from '../components/BrandLogo.js';

export function PublicSearchPage() {
  const [searchParams] = useSearchParams();
  const [classificationCode, setClassificationCode] = useState(
    () => searchParams.get('codigo') ?? '',
  );
  const [result, setResult] = useState<PublicSearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const requestSequence = useRef(0);
  const automaticallySearchedCode = useRef<string | null>(null);

  const search = useCallback(async (rawCode: string): Promise<void> => {
    const code = rawCode.trim();
    const requestId = ++requestSequence.current;
    if (!code) {
      setBusy(false);
      setResult(null);
      setError('Escribí un código de clasificación.');
      return;
    }
    if (code.length > 60) {
      setBusy(false);
      setResult(null);
      setError('El código de clasificación no puede superar 60 caracteres.');
      return;
    }

    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const nextResult = await api.publicSearch({ classificationCode: code });
      if (requestSequence.current === requestId) setResult(nextResult);
    } catch (cause) {
      if (requestSequence.current === requestId) {
        setResult(null);
        setError(
          cause instanceof ApiRequestError
            ? cause.message
            : 'No se pudo consultar la ubicación en este momento.',
        );
      }
    } finally {
      if (requestSequence.current === requestId) setBusy(false);
    }
  }, []);

  useEffect(() => {
    const code = searchParams.get('codigo');
    if (code === null || automaticallySearchedCode.current === code) return;

    automaticallySearchedCode.current = code;
    setClassificationCode(code);
    void search(code);
  }, [search, searchParams]);

  function handleSubmit(event: FormEvent): void {
    event.preventDefault();
    void search(classificationCode);
  }

  return (
    <div className="public-search-page">
      <header className="public-search-header">
        <BrandLogo onDark />
        <Link to="/acceso" className="button-on-dark">
          Ingresar al panel administrativo
        </Link>
      </header>
      <main id="contenido" className="public-search-main">
        <section className="public-search-intro">
          <p className="section-eyebrow">Consulta de colección</p>
          <h1>Encontrá tu libro</h1>
          <p>
            Ingresá el código de clasificación de la etiqueta para conocer dónde buscarlo.
          </p>

          <form className="public-search-form" onSubmit={handleSubmit} noValidate>
            <label htmlFor="classification-code">Código de clasificación</label>
            <div className="public-search-controls">
              <input
                id="classification-code"
                name="classificationCode"
                value={classificationCode}
                onChange={(event) => setClassificationCode(event.target.value)}
                placeholder="Ejemplo: 863.64 C355c"
                autoComplete="off"
                maxLength={60}
              />
              <button type="submit" className="button-primary" disabled={busy}>
                {busy ? 'Buscando...' : 'Buscar ubicación'}
              </button>
            </div>
            <p className="public-search-help">
              Copiá el código completo, incluidos letras, puntos y números.
            </p>
          </form>

          {error ? (
            <p role="alert" className="public-search-error">
              {error}
            </p>
          ) : null}
        </section>

        {result ? <ApproximateLocation result={result} /> : null}
      </main>
    </div>
  );
}
