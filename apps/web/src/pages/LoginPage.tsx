import { useState, type FormEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';

import { ApiRequestError } from '../api/client.js';
import { useSession } from '../api/session.js';
import { BrandLogo } from '../components/BrandLogo.js';

const bjffImage = new URL('../../../../BJFF.png', import.meta.url).href;

export function LoginPage() {
  const { signIn } = useSession();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await signIn(username, password);
    } catch (cause) {
      setError(
        cause instanceof ApiRequestError ? cause.message : 'No se pudo iniciar sesión.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login-page">
      <div className="login-card">
        <div className="login-image-wrap">
          <img
            src={bjffImage}
            alt="Edificio de la Biblioteca José Figueres Ferrer"
            className="login-image"
          />
          <div className="login-image-shade" />
          <div className="login-image-brand">
            <BrandLogo onDark />
          </div>
        </div>

        <div className="login-card-body">
          <p className="login-eyebrow">Panel administrativo</p>
          <h1>Localizador de libros</h1>
          <p className="login-intro">
            Ingresá con tu cuenta autorizada para administrar la colección.
          </p>

          <form onSubmit={handleSubmit} className="mt-7 grid gap-4" noValidate>
            <LoginField
              id="username"
              label="Usuario"
              autoComplete="username"
              value={username}
              onChange={setUsername}
              icon={<UserIcon />}
            />
            <LoginField
              id="password"
              label="Contraseña"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={setPassword}
              icon={<LockIcon />}
            />

            <p
              role="alert"
              aria-live="assertive"
              className="min-h-5 text-center text-sm text-red-700"
            >
              {error}
            </p>

            <button type="submit" disabled={busy} className="button-primary mx-auto px-8">
              {busy ? 'Ingresando…' : 'Ingresar'}
            </button>
          </form>

          <div className="login-public-access">
            <span>¿Solo necesitás consultar una ubicación?</span>
            <Link to="/buscar" className="button-secondary">
              Ir a búsqueda pública
            </Link>
          </div>

          <p className="login-help">
            Las cuentas se administran fuera de esta aplicación. Si necesitás acceso,
            contactá a la persona responsable del repositorio.
          </p>
        </div>
      </div>
    </main>
  );
}

function LoginField({
  id,
  label,
  type = 'text',
  autoComplete,
  value,
  onChange,
  icon,
}: {
  id: string;
  label: string;
  type?: string;
  autoComplete: string;
  value: string;
  onChange: (value: string) => void;
  icon: ReactNode;
}) {
  return (
    <label className="login-field" htmlFor={id}>
      <span className="sr-only">{label}</span>
      <span className="login-field-icon" aria-hidden="true">
        {icon}
      </span>
      <input
        id={id}
        name={id}
        type={type}
        autoComplete={autoComplete}
        required
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={label}
        aria-label={label}
      />
    </label>
  );
}

function UserIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm-9 9a9 9 0 0 1 18 0v1H3v-1Z" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 9V7a5 5 0 0 1 10 0v2h1.5A2.5 2.5 0 0 1 21 11.5v8A2.5 2.5 0 0 1 18.5 22h-13A2.5 2.5 0 0 1 3 19.5v-8A2.5 2.5 0 0 1 5.5 9H7Zm2 0h6V7a3 3 0 0 0-6 0v2Z" />
    </svg>
  );
}
