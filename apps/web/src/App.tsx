import {
  Navigate,
  NavLink,
  Outlet,
  Route,
  Routes,
  useLocation,
  useParams,
} from 'react-router-dom';

import { useSession } from './api/session.js';
import { BrandLogo } from './components/BrandLogo.js';
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
      <p role="status" className="p-8 text-slate-600">
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
      <main id="contenido" className="app-content mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <Routes>
          <Route path="/" element={<Navigate to="/importaciones/importar" replace />} />
          <Route
            path="/acceso"
            element={<Navigate to="/importaciones/importar" replace />}
          />

          <Route
            path="/importaciones"
            element={
              <SectionLayout
                eyebrow="Gestión de colección"
                title="Importaciones"
                description="Importá nuevos archivos y consultá el historial de cargas procesadas."
                tabs={[
                  { to: '/importaciones/importar', label: 'Importar archivo' },
                  { to: '/importaciones/historial', label: 'Historial' },
                ]}
              />
            }
          >
            <Route index element={<Navigate to="importar" replace />} />
            <Route path="importar" element={<ImportPage />} />
            <Route path="historial" element={<LoadsPage />} />
            <Route path="historial/:id" element={<LoadDetailPage />} />
            <Route path="historial/:id/registros" element={<LoadBooksPage />} />
          </Route>

          <Route
            path="/esquemas"
            element={
              <SectionLayout
                eyebrow="Organización física"
                title="Esquemas"
                description="Diseñá plantillas reutilizables y construí con ellas la estructura física de la biblioteca."
                tabs={[
                  { to: '/esquemas/schemes', label: 'Esquemas físicos' },
                  { to: '/esquemas/plantillas', label: 'Plantillas' },
                ]}
              />
            }
          >
            <Route index element={<Navigate to="schemes" replace />} />
            <Route path="schemes" element={<SchemesPage />} />
            <Route path="schemes/:id" element={<SchemeEditorPage />} />
            <Route path="plantillas" element={<TemplatesPage />} />
            <Route path="plantillas/:id" element={<TemplateEditorPage />} />
          </Route>

          <Route
            path="/cargas"
            element={<Navigate to="/importaciones/historial" replace />}
          />
          <Route
            path="/cargas/importar"
            element={<Navigate to="/importaciones/importar" replace />}
          />
          <Route
            path="/cargas/:id"
            element={<LegacyRedirect base="/importaciones/historial" />}
          />
          <Route
            path="/cargas/:id/registros"
            element={
              <LegacyRedirect base="/importaciones/historial" suffix="/registros" />
            }
          />
          <Route
            path="/plantillas"
            element={<Navigate to="/esquemas/plantillas" replace />}
          />
          <Route
            path="/plantillas/:id"
            element={<LegacyRedirect base="/esquemas/plantillas" />}
          />
          <Route path="/schemes" element={<Navigate to="/esquemas/schemes" replace />} />
          <Route
            path="/schemes/:id"
            element={<LegacyRedirect base="/esquemas/schemes" />}
          />
          <Route path="*" element={<p>La página no existe.</p>} />
        </Routes>
      </main>
    </div>
  );
}

function Header() {
  const { user, signOut } = useSession();

  const navClass = ({ isActive }: { isActive: boolean }) =>
    `site-nav-link ${isActive ? 'site-nav-link-active' : ''}`;

  return (
    <header className="site-header">
      <a href="#contenido" className="skip-link">
        Saltar al contenido
      </a>
      <div className="site-header-inner">
        <div className="site-brand">
          <BrandLogo onDark compact />
        </div>
        <nav aria-label="Principal" className="site-nav">
          <NavLink className={navClass} to="/importaciones">
            Importaciones
          </NavLink>
          <NavLink className={navClass} to="/esquemas">
            Esquemas
          </NavLink>
        </nav>
        <div className="site-account">
          <span>{user?.username}</span>
          <button type="button" onClick={() => void signOut()} className="button-on-dark">
            Cerrar sesión
          </button>
        </div>
      </div>
    </header>
  );
}

function SectionLayout({
  eyebrow,
  title,
  description,
  tabs,
}: {
  eyebrow: string;
  title: string;
  description: string;
  tabs: Array<{ to: string; label: string }>;
}) {
  return (
    <div>
      <header className="section-hero">
        <p className="section-eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p>{description}</p>
      </header>
      <nav aria-label={`Secciones de ${title}`} className="section-tabs">
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) =>
              `section-tab ${isActive ? 'section-tab-active' : ''}`
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </nav>
      <div className="section-body">
        <Outlet />
      </div>
    </div>
  );
}

function LegacyRedirect({ base, suffix = '' }: { base: string; suffix?: string }) {
  const { id } = useParams();
  return <Navigate to={`${base}/${id}${suffix}`} replace />;
}
