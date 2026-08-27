import { Link } from 'react-router-dom';

import { Brand } from '../components/Brand';
import { ArrowIcon, GitHubIcon, SearchIcon, UserIcon } from '../components/Icons';

export function SearchScreen() {
  return (
    <div className="public-page">
      <header className="top-bar">
        <Link to="/" className="brand-link" aria-label="Ir al inicio">
          <Brand />
        </Link>

        <Link className="private-access-link" to="/login">
          <UserIcon className="icon" />
          <span>Acceso administrador</span>
        </Link>
      </header>

      <main>
        <section className="search-hero" aria-labelledby="main-title">
          <div className="search-hero__copy">
            <p className="overline">Biblioteca José Figueres Ferrer</p>
            <h1 id="main-title">Tu libro. Sin dar vueltas.</h1>
            <p className="introduction">
              Ingrese el código de clasificación del libro para consultar su ubicación aproximada.
            </p>
          </div>

          <form className="search-panel">
            <label htmlFor="classification-code">Código de clasificación</label>
            <div className="search-field">
              <SearchIcon className="icon search-field__icon" />
              <input
                id="classification-code"
                name="classification-code"
                placeholder="Ej. 001.4 B268-I-2 23"
                autoComplete="off"
                spellCheck="false"
                maxLength={80}
              />
              <button type="button">
                <span>Buscar ubicación</span>
                <ArrowIcon className="icon" />
              </button>
            </div>
          </form>
        </section>
      </main>

      <footer className="public-footer">
        <a
          className="source-link"
          href="https://github.com/AleeBonilla/bjff-book-locator"
          target="_blank"
          rel="noreferrer"
        >
          <GitHubIcon className="icon" />
          Código fuente
        </a>
        <span>Localizador de libros</span>
      </footer>
    </div>
  );
}
