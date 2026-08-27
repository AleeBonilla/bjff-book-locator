import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

export function UserIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
      <path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
    </svg>
  );
}

export function LockIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <rect x="5" y="10" width="14" height="10" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

export function ArrowIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4 4" />
    </svg>
  );
}

export function GitHubIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path d="M12 2.75a9.25 9.25 0 0 0-2.93 18.02c.46.08.63-.2.63-.44v-1.8c-2.56.56-3.1-1.09-3.1-1.09-.42-1.06-1.02-1.34-1.02-1.34-.83-.57.06-.56.06-.56.92.06 1.4.94 1.4.94.82 1.4 2.15 1 2.68.77.08-.59.32-1 .58-1.23-2.04-.23-4.19-1.02-4.19-4.57 0-1.01.36-1.84.95-2.48-.1-.23-.41-1.17.09-2.45 0 0 .77-.25 2.54.95A8.8 8.8 0 0 1 12 7.2c.79 0 1.57.1 2.31.31 1.76-1.2 2.54-.95 2.54-.95.5 1.28.18 2.22.09 2.45.59.64.95 1.47.95 2.48 0 3.56-2.16 4.33-4.21 4.56.33.29.62.85.62 1.71v2.57c0 .24.17.53.63.44A9.25 9.25 0 0 0 12 2.75Z" />
    </svg>
  );
}
