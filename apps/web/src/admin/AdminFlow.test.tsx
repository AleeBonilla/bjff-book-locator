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
  fireEvent.click(await screen.findByRole('button', { name: buttonName }));
  const dialog = screen.getByRole('dialog');
  fireEvent.change(within(dialog).getByLabelText('Cantidad'), { target: { value: '1' } });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Añadir' }));
  await waitForElementToBeRemoved(dialog);
}

describe('flujo administrativo', () => {
  afterEach(() => {
    window.history.replaceState({}, '', '/');
  });

  it('separa esquemas por estado y conserva una guía estable de siete etapas', async () => {
    await login();

    expect(screen.getByRole('heading', { name: 'Esquema activo' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Listos para publicar' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Borradores' })).toBeInTheDocument();

    const draft = screen.getByRole('row', { name: /Colección de reserva/ });
    fireEvent.click(within(draft).getByRole('link', { name: 'Continuar' }));

    expect(await screen.findByRole('heading', { name: 'Definir niveles' })).toBeInTheDocument();
    const workflow = screen.getByRole('navigation', { name: 'Progreso de configuración' });
    expect(within(workflow).getAllByText(/^0[1-7]$/)).toHaveLength(7);
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
    expect(await screen.findByText(/-1-1-1-1-1$/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar ubicaciones' }));

    expect(await screen.findByText('Las ubicaciones están confirmadas.')).toBeInTheDocument();
    const workflow = screen.getByRole('navigation', { name: 'Progreso de configuración' });
    expect(within(workflow).getByRole('link', { name: '04 Mapas' })).toBeInTheDocument();
    expect(within(workflow).getByRole('link', { name: '05 Rangos' })).toBeInTheDocument();
  });

  it('ejecuta una búsqueda interna con coincidencias, mapas y ruta textual', async () => {
    await login();
    fireEvent.click(screen.getByRole('link', { name: 'Pruebas de búsqueda' }));
    expect(screen.getByText('Consulta esquemas con rangos parcial o completamente definidos.')).toBeInTheDocument();
    const schemeSelect = screen.getByLabelText('Esquema');
    expect(within(schemeSelect).getAllByRole('option')).toHaveLength(2);
    expect(within(schemeSelect).queryByRole('option', { name: 'Sala de referencia' })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Signatura'), { target: { value: '515 A' } });
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));

    expect(await screen.findByText('3 ubicaciones encontradas')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /Vista superior/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Ruta textual' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Frontal' })).toBeEnabled();
  });

  it('permite consultar asignaciones frontales de un esquema publicado', async () => {
    await login();
    const activeScheme = screen.getByRole('row', { name: /Colección general 2025/ });
    fireEvent.click(within(activeScheme).getByRole('link', { name: 'Ver' }));

    const workflow = await screen.findByRole('navigation', { name: 'Progreso de configuración' });
    fireEvent.click(within(workflow).getByRole('link', { name: '04 Mapas' }));
    fireEvent.click(await screen.findByRole('tab', { name: 'Vista frontal' }));

    const disclosure = document.querySelector<HTMLDetailsElement>('.admin-readonly-select');
    expect(disclosure).not.toBeNull();
    fireEvent.click(disclosure!.querySelector('summary')!);

    expect(disclosure).toHaveAttribute('open');
    expect(within(disclosure!).getAllByText('Tres anaqueles')).toHaveLength(2);
  });

  it('advierte el estado y los datos afectados antes de eliminar un esquema', async () => {
    await login();
    const activeScheme = screen.getByRole('row', { name: /Colección general 2025/ });
    fireEvent.click(within(activeScheme).getByRole('link', { name: 'Ver' }));
    const workflow = await screen.findByRole('navigation', { name: 'Progreso de configuración' });
    fireEvent.click(within(workflow).getByRole('link', { name: '07 Zona de riesgo' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Eliminar esquema' }));

    const dialog = screen.getByRole('dialog', { name: 'Confirmar eliminación' });
    expect(within(dialog).getByText('Activo')).toBeInTheDocument();
    expect(within(dialog).getByText('La búsqueda pública quedará sin un esquema activo.')).toBeInTheDocument();
    expect(within(dialog).getByText(/Esta acción no se puede deshacer/)).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Eliminar definitivamente' }));
    expect(await screen.findByRole('heading', { name: 'Esquemas' })).toBeInTheDocument();
    expect(screen.queryByRole('row', { name: /Colección general 2025/ })).not.toBeInTheDocument();
  });

  it('abre pruebas de búsqueda con el esquema revisado preseleccionado', async () => {
    await login();
    const readyScheme = screen.getByRole('row', { name: /Colección general 2026/ });
    fireEvent.click(within(readyScheme).getByRole('link', { name: 'Revisar' }));
    fireEvent.click(await screen.findByRole('link', { name: 'Probar búsqueda' }));

    const schemeSelect = await screen.findByLabelText('Esquema');
    expect(schemeSelect).toHaveValue('23');
    expect(window.location.search).toBe('?schemeId=23');
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
