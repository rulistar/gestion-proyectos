import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from './app.js';
import { createTestDb, resetDb } from './test/test-db.js';
import { userWithSession } from './test/users.js';

const db = createTestDb();
const local = buildApp({ db });
// Como en Render: detrás de un proxy que avisa que la petición llegó por HTTPS
const production = buildApp({ db, security: { production: true }, trustProxy: true });
const https = { 'x-forwarded-proto': 'https' };

afterAll(async () => {
  await Promise.all([local.close(), production.close()]);
  await db.$disconnect();
});

beforeEach(async () => {
  await resetDb(db);
});

interface OpenApiDoc {
  openapi: string;
  paths: Record<string, Record<string, Record<string, unknown>>>;
}

describe('documentación de la API (TEC-05)', () => {
  it('publica OpenAPI 3 con todas las rutas, agrupadas y con el contrato de las principales', async () => {
    const response = await local.inject({ url: '/api/v1/docs/json' });
    expect(response.statusCode).toBe(200);
    const doc = response.json<OpenApiDoc>();
    expect(doc.openapi).toBe('3.0.3');
    expect(Object.keys(doc.paths).length).toBeGreaterThan(50);

    const projects = doc.paths['/api/v1/workspaces/{workspaceId}/projects']!;
    expect(projects.post).toMatchObject({
      tags: ['Proyectos'],
      summary: 'Crear un contenedor',
      requestBody: { content: { 'application/json': { schema: { type: 'object' } } } },
    });
    expect(Object.keys(projects.post!.responses as object)).toContain('201');
    // Las fases y las tareas van en su propio grupo aunque cuelguen de un proyecto
    const phases = doc.paths['/api/v1/workspaces/{workspaceId}/projects/{projectId}/phases']!;
    expect(phases.get!.tags).toEqual(['Fases']);
    expect(phases.get!.parameters).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: 'projectId', in: 'path' })]),
    );
    // Las rutas sin detalle también aparecen, con su grupo
    expect(doc.paths['/api/v1/workspaces/{workspaceId}/trash']!.get!.tags).toEqual(['Papelera']);
  });

  it('la página abre en local', async () => {
    const response = await local.inject({ url: '/api/v1/docs/' });
    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('text/html');
  });

  it('en producción pide sesión iniciada (decisión del PO)', async () => {
    const anonymous = await production.inject({ url: '/api/v1/docs/json', headers: https });
    expect(anonymous.statusCode).toBe(401);
    const ana = await userWithSession(db, 'ana@example.com');
    const withSession = await production.inject({
      url: '/api/v1/docs/json',
      headers: https,
      cookies: ana.cookies,
    });
    expect(withSession.statusCode).toBe(200);
  });
});
