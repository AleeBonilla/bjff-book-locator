import type { ReactNode } from 'react';

export function PageLoading({ label = 'Cargando…' }: { label?: string }) {
  return <p className="admin-state" role="status">{label}</p>;
}

export function PageError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="admin-state admin-state--error" role="alert">
      <p>{message}</p>
      {onRetry ? <button className="admin-button admin-button--quiet" type="button" onClick={onRetry}>Reintentar</button> : null}
    </div>
  );
}

export function Modal({
  children,
  title,
  onClose,
}: {
  children: ReactNode;
  title: string;
  onClose: () => void;
}) {
  return (
    <div className="admin-modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="admin-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-modal-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="admin-modal__heading">
          <h2 id="admin-modal-title">{title}</h2>
          <button className="admin-icon-button" type="button" onClick={onClose} aria-label="Cerrar">×</button>
        </div>
        {children}
      </section>
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="admin-empty">{children}</div>;
}
