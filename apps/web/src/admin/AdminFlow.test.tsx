import { fireEvent, render, screen, waitForElementToBeRemoved, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { App } from '../App';

async function login() {
  window.history.replaceState({}, '', '/login');
  const view = render(<App />);
  fireEvent.change(screen.getByLabelText('Usuario'), { target: { value: 'admin' } });
  fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'admin' } });
  fireEvent.click(screen.getByRole('button', { name: 'Ingresar' }));
  await screen.findByRole('heading', { name: 'Esquemas' });
  return view;
}

async function addSingleLocation(buttonName: string) {
  fireEvent.click(screen.getByRole('button', { name: buttonName }));
  const dialog = screen.getByRole('dialog');
  fireEvent.change(within(dialog).getByLabelText('Cantidad'), { target: { value: '1' } });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Añadir', exact: true }));
  await waitForElementToBeRemoved(dialog);
}

describe('flujo administrativo', () => {
  afterEach(() => {
    window.history.replaceState({}, '', '/');
  });

  it('separa esquemas por estado y conserva una guía estable de seis etapas', async () => {
    await login();

    expect(screen.getByRole('heading', { name: 'Esquema activo' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Listos para publicar' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Borradores' })).toBeInTheDocument();

    const draft = screen.getByRole('row', { name: /Colección de reserva/ });
    fireEvent.click(within(draft).getByRole('link', { name: 'Continuar' }));

    expect(await screen.findByRole('heading', { name: 'Definir niveles' })).toBeInTheDocument();
    const workflow = screen.getByRole('navigation', { name: 'Progreso de configuración' });
    expect(within(workflow).getAllByText(/^0[1-6]$/)).toHaveLength(6);
    expect(within(workflow).getByRole('link', { name: '02 Niveles' })).toHaveClass('active');
  });

  it('crea un esquema y materializa una rama completa sin exponer la raíz interna', async () => {
    await login();
    fireEvent.click(screen.getByRole('link', { name: 'Crear esquema' }));
    fireEvent.change(screen.getByLabelText('Nombre del esquema'), { target: { value: 'Esquema de integración' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar y definir niveles' }));

    expect(await screen.findByRole('heading', { name: 'Definir niveles' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar niveles' }));
    expect(await screen.findByRole('heading', { name: 'Crear ubicaciones' })).toBeInTheDocument();

    await addSingleLocation('Añadir Piso');
    await addSingleLocation('Añadir Fila bajo Piso 1');
    await addSingleLocation('Añadir Cara bajo Fila 1');
    await addSingleLocation('Añadir Mueble bajo Cara 1');
    await addSingleLocation('Añadir Anaquel bajo Mueble 1');

    expect(screen.queryByText(/raíz interna/i)).not.toBeInTheDocument();
    expect(screen.getByText(/-1-1-1-1-1$/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar ubicaciones' }));

    expect(await screen.findByText('Las ubicaciones están confirmadas.')).toBeInTheDocument();
    const workflow = screen.getByRole('navigation', { name: 'Progreso de configuración' });
    expect(within(workflow).getByRole('link', { name: '04 Mapas' })).toBeInTheDocument();
    expect(within(workflow).getByRole('link', { name: '05 Rangos' })).toBeInTheDocument();
  });

  it('ejecuta una búsqueda interna con coincidencias, mapas y ruta textual', async () => {
    await login();
    fireEvent.click(screen.getByRole('link', { name: 'Pruebas de búsqueda' }));
    fireEvent.change(screen.getByLabelText('Signatura'), { target: { value: '515 A' } });
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));

    expect(await screen.findByText('3 ubicaciones encontradas')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /Vista superior/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Ruta textual' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Frontal' })).toBeEnabled();
  });

  it('pierde la sesión y los datos mock al montar nuevamente la aplicación', async () => {
    const view = await login();
    expect(window.location.pathname).toBe('/admin');

    // Un nuevo montaje representa una recarga completa: no existe persistencia del proveedor.
    view.unmount();
    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/login');
  });
});
