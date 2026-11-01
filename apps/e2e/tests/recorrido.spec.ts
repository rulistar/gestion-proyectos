import { expect, test } from '@playwright/test';

/**
 * El recorrido básico del MVP en un navegador real: si algo entre la web, la API y la BD se
 * rompe (rutas, cookies de sesión, permisos, cálculo del avance), esta prueba lo detecta.
 */
test('iniciar sesión, crear un proyecto con una tarea, terminarla y ver el avance', async ({
  page,
}) => {
  await page.goto('/login');
  await page.getByLabel('Correo').fill(process.env.E2E_ADMIN_EMAIL!);
  await page.getByLabel('Contraseña', { exact: true }).fill(process.env.E2E_ADMIN_PASSWORD!);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  // Directo al primer espacio (workpers, creado con el primer Admin)
  await expect(page).toHaveURL(/\/w\/[0-9a-f-]+$/);

  await page.getByRole('button', { name: 'Nuevo proyecto' }).click();
  const projectDialog = page.getByRole('dialog');
  await projectDialog.getByLabel('Nombre', { exact: true }).fill('Portal de clientes');
  await projectDialog.getByRole('button', { name: 'Crear', exact: true }).click();
  // Al crearlo se abre el proyecto, en la pestaña Tablero
  await expect(page.getByRole('heading', { name: 'Portal de clientes' })).toBeVisible();

  await page.getByRole('button', { name: 'Nueva tarea' }).click();
  const taskDialog = page.getByRole('dialog');
  await taskDialog.getByLabel('Título').fill('Diseñar la pantalla de inicio');
  await taskDialog.getByRole('button', { name: 'Crear tarea' }).click();
  await expect(taskDialog).toBeHidden();

  const progress = page.getByRole('progressbar', { name: 'Avance del proyecto' });
  await expect(progress).toHaveAttribute('aria-valuenow', '0');

  await page
    .getByLabel('Estado de "Diseñar la pantalla de inicio"')
    .selectOption({ label: 'Hecha' });
  await expect(progress).toHaveAttribute('aria-valuenow', '100');
  await expect(page.getByText('1 de 1 tareas')).toBeVisible();
});
