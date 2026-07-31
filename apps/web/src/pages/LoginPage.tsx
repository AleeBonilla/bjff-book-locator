import { useState, type FormEvent } from 'react';

import { ApiRequestError } from '../api/client.js';
import { useSession } from '../api/session.js';

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
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4">
      <h1 className="mb-6 text-xl font-semibold">Panel administrativo · BJFF</h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <div className="flex flex-col gap-1">
          <label htmlFor="username" className="text-sm font-medium">
            Usuario
          </label>
          <input
            id="username"
            name="username"
            autoComplete="username"
            required
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            className="rounded border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="password" className="text-sm font-medium">
            Contraseña
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="rounded border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
          />
        </div>

        {/* El error se anuncia a los lectores de pantalla al aparecer. */}
        <p role="alert" aria-live="assertive" className="min-h-5 text-sm text-red-700 dark:text-red-400">
          {error}
        </p>

        <button
          type="submit"
          disabled={busy}
          className="rounded bg-sky-700 px-4 py-2 font-medium text-white hover:bg-sky-800 disabled:opacity-60"
        >
          {busy ? 'Entrando…' : 'Entrar'}
        </button>
      </form>

      <p className="mt-6 text-sm text-slate-600 dark:text-slate-400">
        Las cuentas se crean fuera de la aplicación. Si no tenés acceso, contactá a la
        persona responsable del repositorio.
      </p>
    </main>
  );
}
