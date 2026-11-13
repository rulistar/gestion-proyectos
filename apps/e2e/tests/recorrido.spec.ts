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

/**
 * Invitación para alguien que ya tiene cuenta pero no ha iniciado sesión: «Iniciar sesión y
 * aceptar» debe llevarlo al espacio. Antes, al iniciar sesión la página cambiaba de vista a la
 * mitad y se quedaba en «Aceptar invitación» con la invitación ya usada.
 */
test('aceptar una invitación iniciando sesión con una cuenta existente', async ({
  browser,
  request,
}) => {
  const api = (path: string) => `/api/v1${path}`;
  const invitedEmail = 'invitada@e2e.example.com';
  const invitedPassword = `${process.env.E2E_ADMIN_PASSWORD!}-invitada`;

  // Preparación por la API, con la sesión del Admin
  const login = await request.post(api('/auth/login'), {
    data: { email: process.env.E2E_ADMIN_EMAIL!, password: process.env.E2E_ADMIN_PASSWORD! },
  });
  expect(login.ok()).toBe(true);
  const admin = (await login.json()) as { workspaces: { id: string }[] };

  async function invite(workspaceId: string) {
    const response = await request.post(api(`/workspaces/${workspaceId}/invitations`), {
      data: { email: invitedEmail, role: 'MEMBER' },
    });
    expect(response.status()).toBe(201);
    return ((await response.json()) as { token: string }).token;
  }

  // La persona ya tiene cuenta: aceptó una invitación anterior creando su contraseña
  const firstToken = await invite(admin.workspaces[0]!.id);
  const register = await browser.newContext();
  const registered = await register.request.post(api('/invitations/register'), {
    data: { token: firstToken, name: 'Invitada', password: invitedPassword },
  });
  expect(registered.ok()).toBe(true);
  await register.close();

  // Ahora la invitan a otro espacio y abre el enlace sin sesión
  const created = await request.post(api('/workspaces'), {
    data: { name: 'Proyectos del equipo' },
  });
  expect(created.status()).toBe(201);
  const workspace = (await created.json()) as { id: string };
  const token = await invite(workspace.id);

  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`/invitacion#${token}`);
  await expect(page.getByText('Ya tienes una cuenta: inicia sesión para aceptar.')).toBeVisible();

  const password = page.getByLabel('Contraseña', { exact: true });
  const submit = page.getByRole('button', { name: 'Iniciar sesión y aceptar' });
  await password.fill('una contraseña equivocada');
  await submit.click();
  await expect(page.getByText('Correo o contraseña incorrectos')).toBeVisible();

  await password.fill(invitedPassword);
  await submit.click();
  await expect(page).toHaveURL(new RegExp(`/w/${workspace.id}$`));
  await context.close();
});
