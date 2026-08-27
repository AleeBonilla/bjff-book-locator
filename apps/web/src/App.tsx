import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import { AdminRoot } from './admin/components/AdminShell';
import { WorkflowLayout } from './admin/components/WorkflowLayout';
import { LevelsScreen } from './admin/screens/LevelsScreen';
import { LocationsScreen } from './admin/screens/LocationsScreen';
import { MapsScreen } from './admin/screens/MapsScreen';
import { RangesScreen } from './admin/screens/RangesScreen';
import { ReviewScreen } from './admin/screens/ReviewScreen';
import { NewSchemeScreen, SchemeDetailsScreen } from './admin/screens/SchemeDetailsScreen';
import { SchemesDashboard } from './admin/screens/SchemesDashboard';
import { SearchTestsScreen } from './admin/screens/SearchTestsScreen';
import { AuthProvider } from './auth/AuthContext';
import { ProtectedRoute } from './auth/ProtectedRoute';
import { LoginScreen } from './screens/LoginScreen';
import { SearchScreen } from './screens/SearchScreen';

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<SearchScreen />} />
          <Route path="/login" element={<LoginScreen />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/admin" element={<AdminRoot />}>
              <Route index element={<SchemesDashboard />} />
              <Route path="search-tests" element={<SearchTestsScreen />} />
              <Route path="schemes/new" element={<NewSchemeScreen />} />
              <Route path="schemes/:schemeId" element={<WorkflowLayout />}>
                <Route index element={<Navigate to="details" replace />} />
                <Route path="details" element={<SchemeDetailsScreen />} />
                <Route path="levels" element={<LevelsScreen />} />
                <Route path="locations" element={<LocationsScreen />} />
                <Route path="maps" element={<MapsScreen />} />
                <Route path="ranges" element={<RangesScreen />} />
                <Route path="review" element={<ReviewScreen />} />
              </Route>
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
