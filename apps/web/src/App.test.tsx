import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { App } from './App';
import { MockAdminGateway } from './admin/MockAdminGateway';

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

  it('protege las rutas administrativas', () => {
    window.history.replaceState({}, '', '/admin');
    render(<App />);

    expect(screen.getByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/login');
  });

  it('rechaza credenciales incorrectas', () => {
    window.history.replaceState({}, '', '/login');
    render(<App />);

    fireEvent.change(screen.getByLabelText('Usuario'), { target: { value: 'otro' } });
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'incorrecta' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ingresar' }));

    expect(screen.getByRole('alert')).toHaveTextContent(
      'El usuario o la contraseña no son correctos.',
    );
  });

  it('permite entrar y cerrar la sesión mock', async () => {
    window.history.replaceState({}, '', '/login');
    render(<App adminGateway={new MockAdminGateway()} />);

    fireEvent.change(screen.getByLabelText('Usuario'), { target: { value: 'admin' } });
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'admin' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ingresar' }));

    expect(await screen.findByRole('heading', { name: 'Esquemas' })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/admin');

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }));

    expect(screen.getByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument();
  });
});
