import { NavLink, Outlet, useNavigate } from 'react-router-dom';

import { useAuth } from '../../auth/AuthContext';
import { Brand } from '../../components/Brand';
import type { AdminGateway } from '../AdminGateway';
import { AdminProvider, useAdmin } from '../AdminContext';

function AdminLayout() {
  const { logout } = useAuth();
  const { notice, pending } = useAdmin();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="admin-page">
      <header className="admin-topbar">
        <NavLink className="admin-brand" to="/admin" aria-label="Ir a esquemas">
          <span className="admin-brand__logo"><Brand /></span>
          <span className="admin-brand__copy">
            <strong>Panel de configuración</strong>
            <span>Biblioteca José Figueres Ferrer</span>
          </span>
        </NavLink>
      </header>

      <div className="admin-shell">
        <aside className="admin-sidebar" aria-label="Administración">
          <nav>
            <NavLink className="admin-nav-link" end to="/admin">Esquemas</NavLink>
            <NavLink className="admin-nav-link" to="/admin/search-tests">Pruebas de búsqueda</NavLink>
          </nav>
          <button className="admin-logout" type="button" onClick={handleLogout}>Cerrar sesión</button>
        </aside>

        <main className="admin-main" aria-busy={pending} inert={pending}>
          <Outlet />
        </main>
      </div>

      {notice ? (
        <div className={`admin-toast admin-toast--${notice.tone}`} role="status">
          {notice.message}
        </div>
      ) : null}
    </div>
  );
}

export function AdminRoot({ gateway }: { gateway?: AdminGateway | undefined }) {
  return (
    <AdminProvider gateway={gateway}>
      <AdminLayout />
    </AdminProvider>
  );
}
