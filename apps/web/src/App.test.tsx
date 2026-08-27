import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { App } from './App';

describe('App', () => {
  afterEach(() => {
    window.history.replaceState({}, '', '/');
  });

  it('muestra la búsqueda pública en la ruta inicial', () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: 'Tu libro. Sin dar vueltas.' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Buscar ubicación' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Código fuente' })).toHaveAttribute(
      'href',
      'https://github.com/AleeBonilla/bjff-book-locator',
    );
  });

  it('muestra el acceso privado en la ruta de login', () => {
    window.history.replaceState({}, '', '/login');
    render(<App />);

    expect(screen.getByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ingresar' })).toBeInTheDocument();
  });
});
