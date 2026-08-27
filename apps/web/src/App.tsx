import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import { LoginScreen } from './screens/LoginScreen';
import { SearchScreen } from './screens/SearchScreen';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<SearchScreen />} />
        <Route path="/login" element={<LoginScreen />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
