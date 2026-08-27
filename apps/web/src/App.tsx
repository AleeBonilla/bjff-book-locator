import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import { AuthProvider, useAuth } from './auth/AuthContext';
import { ProtectedRoute } from './auth/ProtectedRoute';
import { LoginScreen } from './screens/LoginScreen';
import { SearchScreen } from './screens/SearchScreen';

function AdminPlaceholder() {
  const { logout } = useAuth();

  return (
    <main>
      <h1>Esquemas</h1>
      <button type="button" onClick={logout}>Cerrar sesión</button>
    </main>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<SearchScreen />} />
          <Route path="/login" element={<LoginScreen />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/admin" element={<AdminPlaceholder />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
