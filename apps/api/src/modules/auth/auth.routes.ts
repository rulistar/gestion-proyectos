import { loginRequestSchema, type CurrentUser } from '@gestion/shared';
import type { FastifyPluginCallback, FastifyRequest } from 'fastify';
import type { Db } from '../../db/client.js';
import { auditUpdate } from '../../db/audit.js';
import { authRateLimit } from '../../security.js';
import { listWorkspacesForUser } from '../workspaces/workspaces.service.js';
import { hashPassword, verifyPassword } from './password.js';
import { createSession, deleteSession, requireAuth, SESSION_COOKIE } from './session.js';

const INVALID_CREDENTIALS = 'Correo o contraseña incorrectos';

/**
 * Hash de una contraseña cualquiera, calculado una sola vez. Si el correo no existe se verifica
 * contra él: así la respuesta tarda lo mismo y el tiempo no revela qué correos tienen cuenta.
 */
let dummyHash: Promise<string> | undefined;
function getDummyHash() {
  dummyHash ??= hashPassword('contraseña-ficticia-para-igualar-tiempos');
  return dummyHash;
}

/** El límite de intentos cuenta por IP + correo: frena a quien prueba contraseñas para una cuenta */
function loginRateLimitKey(request: FastifyRequest): string {
  const body = request.body as { email?: unknown } | undefined;
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  return `${request.ip}|${email}`;
}

async function getCurrentUser(db: Db, userId: string): Promise<CurrentUser> {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    isSystemAdmin: user.isSystemAdmin,
    workspaces: await listWorkspacesForUser(db, userId),
  };
}

export const authRoutes: FastifyPluginCallback = (app, _options, done) => {
  const cookieOptions = {
    path: '/',
    httpOnly: true, // JavaScript del navegador no puede leerla (protege ante XSS)
    sameSite: 'lax', // otros sitios no pueden enviarla en peticiones que modifican datos
    secure: app.secureCookies, // solo por HTTPS en producción
  } as const;

  app.post(
    '/auth/login',
    {
      config: {
        // preHandler: el límite se evalúa con el cuerpo ya leído, para poder usar el correo
        rateLimit: { ...authRateLimit, hook: 'preHandler', keyGenerator: loginRateLimitKey },
      },
    },
    async (request, reply) => {
      const parsed = loginRequestSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ message: 'Escribe tu correo y tu contraseña' });
      }
      const { email, password } = parsed.data;

      const user = await app.db.user.findUnique({ where: { email } });
      const passwordOk = user?.passwordHash
        ? await verifyPassword(user.passwordHash, password)
        : await verifyPassword(await getDummyHash(), password).then(() => false);

      if (!user || !passwordOk || user.status !== 'ACTIVE' || user.kind !== 'HUMAN') {
        return reply.code(401).send({ message: INVALID_CREDENTIALS });
      }

      // Sesión nueva en cada login; la anterior de este navegador (si había) se invalida
      const previous = request.cookies[SESSION_COOKIE];
      if (previous) await deleteSession(app.db, previous);

      const token = await createSession(app.db, {
        userId: user.id,
        idleMinutes: app.sessionIdleMinutes,
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
      });
      await app.db.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date(), ...auditUpdate(user.id) },
      });

      reply.setCookie(SESSION_COOKIE, token, cookieOptions);
      return getCurrentUser(app.db, user.id);
    },
  );

  app.post('/auth/logout', async (request, reply) => {
    const token = request.cookies[SESSION_COOKIE];
    // Se borra en el servidor: aunque alguien hubiera copiado la cookie, ya no sirve
    if (token) await deleteSession(app.db, token);
    return reply.clearCookie(SESSION_COOKIE, cookieOptions).code(204).send();
  });

  app.get('/auth/me', { preHandler: requireAuth }, async (request) => {
    return getCurrentUser(app.db, request.auth!.userId);
  });

  done();
};
