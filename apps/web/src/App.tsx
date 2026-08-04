import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';

import { useSession } from './api/session.js';
import { ImportPage } from './pages/ImportPage.js';
import { LoadBooksPage } from './pages/LoadBooksPage.js';
import { LoadDetailPage } from './pages/LoadDetailPage.js';
import { LoadsPage } from './pages/LoadsPage.js';
import { LoginPage } from './pages/LoginPage.js';
import { SchemeEditorPage } from './pages/SchemeEditorPage.js';
import { SchemesPage } from './pages/SchemesPage.js';
import { TemplateEditorPage } from './pages/TemplateEditorPage.js';
import { TemplatesPage } from './pages/TemplatesPage.js';

export function App() {
  const { user, loading } = useSession();
  const location = useLocation();

  if (loading) {
    return (
      <p role="status" className="p-8 text-slate-600 dark:text-slate-400">
        Cargando…
      </p>
    );
  }

  if (!user) {
    return location.pathname === '/acceso' ? (
      <LoginPage />
    ) : (
      <Navigate to="/acceso" replace />
    );
  }

  return (
    <div className="min-h-screen">
      <Header />
      <main id="contenido" className="mx-auto max-w-5xl px-4 py-8">
        <Routes>
          <Route path="/" element={<Navigate to="/cargas" replace />} />
          <Route path="/acceso" element={<Navigate to="/cargas" replace />} />
          <Route path="/cargas" element={<LoadsPage />} />
          <Route path="/cargas/importar" element={<ImportPage />} />
          <Route path="/cargas/:id" element={<LoadDetailPage />} />
          <Route path="/cargas/:id/registros" element={<LoadBooksPage />} />
          <Route path="/plantillas" element={<TemplatesPage />} />
          <Route path="/plantillas/nueva" element={<TemplatesPage />} />
          <Route path="/plantillas/:id" element={<TemplateEditorPage />} />
          <Route path="/schemes" element={<SchemesPage />} />
          <Route path="/schemes/nuevo" element={<SchemesPage />} />
          <Route path="/schemes/:id" element={<SchemeEditorPage />} />
          <Route path="*" element={<p>La página no existe.</p>} />
        </Routes>
      </main>
    </div>
  );
}

function Header() {
  const { user, signOut } = useSession();

  return (
    <header className="border-b border-slate-200 dark:border-slate-800">
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:absolute focus:m-2 focus:rounded focus:bg-sky-700 focus:px-3 focus:py-2 focus:text-white"
      >
        Saltar al contenido
      </a>
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-4 px-4 py-4">
        <h1 className="text-lg font-semibold">BJFF Book Locator</h1>
        <nav aria-label="Principal" className="flex gap-4 text-sm">
          <Link className="underline underline-offset-4" to="/cargas">
            Cargas
          </Link>
          <Link className="underline underline-offset-4" to="/cargas/importar">
            Importar
          </Link>
          <Link className="underline underline-offset-4" to="/plantillas">
            Plantillas
          </Link>
          <Link className="underline underline-offset-4" to="/schemes">
            Schemes
          </Link>
        </nav>
        <div className="ml-auto flex items-center gap-3 text-sm">
          <span className="text-slate-600 dark:text-slate-400">{user?.username}</span>
          <button
            type="button"
            onClick={() => void signOut()}
            className="rounded border border-slate-300 px-3 py-1 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
          >
            Cerrar sesión
          </button>
        </div>
      </div>
    </header>
  );
}
