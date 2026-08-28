import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import type { AdminGateway } from './AdminGateway';
import { MockAdminGateway } from './MockAdminGateway';
import { AdminGatewayError, type ApiSuccess, type Scheme } from './types';

interface Notice {
  id: number;
  message: string;
  tone: 'success' | 'error';
}

interface AdminContextValue {
  gateway: AdminGateway;
  schemes: Scheme[];
  loading: boolean;
  revision: number;
  notice: Notice | null;
  refresh: () => void;
  notify: (message: string, tone?: Notice['tone']) => void;
  commit: <T>(request: Promise<ApiSuccess<T>>, successMessage?: string) => Promise<T>;
}

const AdminContext = createContext<AdminContextValue | null>(null);

export function AdminProvider({ children }: { children: ReactNode }) {
  const gatewayRef = useRef<AdminGateway>(new MockAdminGateway());
  const [schemes, setSchemes] = useState<Scheme[]>([]);
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const [notice, setNotice] = useState<Notice | null>(null);
  const noticeId = useRef(0);

  const notify = useCallback((message: string, tone: Notice['tone'] = 'success') => {
    const id = ++noticeId.current;
    setNotice({ id, message, tone });
    window.setTimeout(() => {
      setNotice((current) => current?.id === id ? null : current);
    }, 3400);
  }, []);

  const refresh = useCallback(() => {
    setRevision((current) => current + 1);
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    void gatewayRef.current.listSchemes().then(({ data }) => {
      if (active) {
        setSchemes(data);
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, [revision]);

  const commit = useCallback(async <T,>(request: Promise<ApiSuccess<T>>, successMessage?: string) => {
    try {
      const result = await request;
      refresh();
      if (successMessage) notify(successMessage);
      return result.data;
    } catch (error) {
      notify(errorMessage(error), 'error');
      throw error;
    }
  }, [notify, refresh]);

  const value = useMemo<AdminContextValue>(() => ({
    gateway: gatewayRef.current,
    schemes,
    loading,
    revision,
    notice,
    refresh,
    notify,
    commit,
  }), [commit, loading, notice, notify, refresh, revision, schemes]);

  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>;
}

export function useAdmin() {
  const context = useContext(AdminContext);
  if (!context) throw new Error('useAdmin debe utilizarse dentro de AdminProvider.');
  return context;
}

export function useAdminScheme(schemeId: string | undefined) {
  const { gateway, revision } = useAdmin();
  const [scheme, setScheme] = useState<Scheme | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    if (!schemeId) {
      setScheme(null);
      setLoading(false);
      return () => {
        active = false;
      };
    }
    setLoading(true);
    setError('');
    void gateway.getScheme(schemeId)
      .then(({ data }) => {
        if (active) setScheme(data);
      })
      .catch((requestError: unknown) => {
        if (active) setError(errorMessage(requestError));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [gateway, revision, schemeId]);

  return { scheme, loading, error };
}

export function errorMessage(error: unknown) {
  if (error instanceof AdminGatewayError) return error.message;
  if (error instanceof Error) return error.message;
  return 'No se pudo completar la acción.';
}
