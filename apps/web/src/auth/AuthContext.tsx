import { createContext, type ReactNode, useContext, useMemo, useState } from 'react';

export interface MockUser {
  username: string;
  displayName: string;
}

interface AuthContextValue {
  user: MockUser | null;
  login: (username: string, password: string) => boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<MockUser | null>(null);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      login(username, password) {
        if (username !== 'admin' || password !== 'admin') {
          return false;
        }

        setUser({ username: 'admin', displayName: 'Administrador' });
        return true;
      },
      logout() {
        setUser(null);
      },
    }),
    [user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth debe utilizarse dentro de AuthProvider.');
  }

  return context;
}
