import { Link } from 'react-router-dom';

import libraryImage from '../assets/access-background.png';
import { Brand } from '../components/Brand';
import { ArrowIcon, LockIcon, UserIcon } from '../components/Icons';

export function LoginScreen() {
  return (
    <main className="login-page">
      <Link className="back-link" to="/">
        <ArrowIcon className="icon icon--back" />
        Volver a la búsqueda
      </Link>

      <section className="login-card" aria-labelledby="login-title">
        <div className="login-photo">
          <img src={libraryImage} alt="Edificio de la Biblioteca José Figueres Ferrer" />
          <Brand light />
        </div>

        <div className="login-content">
          <span className="access-stamp" aria-hidden="true">Solo personal</span>
          <p className="overline overline--dark">Biblioteca José Figueres Ferrer</p>
          <h1 id="login-title">Iniciar sesión</h1>

          <form className="login-form">
            <label htmlFor="username">Usuario</label>
            <div className="login-field">
              <UserIcon className="icon" />
              <input
                id="username"
                name="username"
                autoComplete="username"
                placeholder="Usuario"
              />
            </div>

            <label htmlFor="password">Contraseña</label>
            <div className="login-field">
              <LockIcon className="icon" />
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                placeholder="Contraseña"
              />
            </div>

            <button className="login-button" type="button">
              Ingresar
              <ArrowIcon className="icon" />
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
