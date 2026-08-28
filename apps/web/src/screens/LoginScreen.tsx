import { type FormEvent, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';

import libraryImage from '../assets/access-background.png';
import { useAuth } from '../auth/AuthContext';
import { Brand } from '../components/Brand';
import { ArrowIcon, LockIcon, UserIcon } from '../components/Icons';

export function LoginScreen() {
  const { login, user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [error, setError] = useState('');

  if (user) {
    return <Navigate to="/admin" replace />;
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const username = String(form.get('username') ?? '');
    const password = String(form.get('password') ?? '');

    if (!login(username, password)) {
      setError('El usuario o la contraseña no son correctos.');
      return;
    }

    const destination = (location.state as { from?: string } | null)?.from ?? '/admin';
    navigate(destination, { replace: true });
  }

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

          <form className="login-form" onSubmit={handleSubmit}>
            <label htmlFor="username">Usuario</label>
            <div className="login-field">
              <UserIcon className="icon" />
              <input
                id="username"
                name="username"
                autoComplete="username"
                placeholder="Usuario"
                required
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
                required
              />
            </div>

            {error ? <p className="login-error" role="alert">{error}</p> : null}

            <button className="login-button" type="submit">
              Ingresar
              <ArrowIcon className="icon" />
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
