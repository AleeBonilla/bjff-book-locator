export function BrandLogo({
  onDark = false,
  compact = false,
}: {
  onDark?: boolean;
  compact?: boolean;
}) {
  return (
    <span
      className={`brand-logo ${onDark ? 'brand-logo-on-dark' : ''} ${compact ? 'brand-logo-compact' : ''}`}
      aria-label="Book Locator, Biblioteca José Figueres Ferrer"
    >
      <span className="brand-wordmark">
        <strong>Book Locator</strong>
        <small>Biblioteca José Figueres Ferrer</small>
      </span>
    </span>
  );
}
