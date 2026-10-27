import { createPersonSchema, updatePersonSchema } from '@gestion/shared';
import { z } from 'zod';
import type { FastifyPluginCallback, FastifyReply } from 'fastify';
import { requireAuth } from '../auth/session.js';
import { requirePermission } from '../workspaces/access.js';
import {
  createPerson,
  DuplicatePersonNameError,
  listPeople,
  NotAMemberError,
  updatePerson,
  UserAlreadyLinkedError,
} from './people.service.js';

const personParamsSchema = z.object({ personId: z.uuid() });

const BASE = '/workspaces/:workspaceId/people';

function peopleError(reply: FastifyReply, error: unknown) {
  if (error instanceof DuplicatePersonNameError) {
    return reply.code(409).send({ message: 'Ya hay una persona con ese nombre en este espacio' });
  }
  if (error instanceof UserAlreadyLinkedError) {
    return reply.code(409).send({ message: 'Ese usuario ya está vinculado a otra persona' });
  }
  if (error instanceof NotAMemberError) {
    return reply
      .code(400)
      .send({ message: 'Solo se vinculan usuarios que son miembros del espacio' });
  }
  throw error;
}

/**
 * Catálogo de personas (HU-34, ADR-0005 §5): lo ve quien ve proyectos (para elegir personas);
 * dar de alta, quien crea tareas (alta rápida desde un formulario); renombrar, vincular y archivar,
 * el Admin
 */
export const peopleRoutes: FastifyPluginCallback = (app, _options, done) => {
  app.addHook('preHandler', requireAuth);

  app.get(BASE, { preHandler: requirePermission('project.read') }, async (request) =>
    listPeople(app.db, request.membership!.workspaceId),
  );

  app.post(BASE, { preHandler: requirePermission('task.create') }, async (request, reply) => {
    const parsed = createPersonSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ message: z.prettifyError(parsed.error) });
    }
    try {
      const id = await createPerson(
        app.db,
        request.auth!.userId,
        request.membership!.workspaceId,
        parsed.data,
      );
      const people = await listPeople(app.db, request.membership!.workspaceId);
      return await reply.code(201).send(people.find((person) => person.id === id));
    } catch (error) {
      return peopleError(reply, error);
    }
  });

  app.patch(
    `${BASE}/:personId`,
    { preHandler: requirePermission('member.manage') },
    async (request, reply) => {
      const params = personParamsSchema.safeParse(request.params);
      if (!params.success) return reply.code(404).send({ message: 'Persona no encontrada' });
      const parsed = updatePersonSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ message: z.prettifyError(parsed.error) });
      }
      try {
        const found = await updatePerson(
          app.db,
          request.auth!.userId,
          request.membership!.workspaceId,
          params.data.personId,
          parsed.data,
        );
        if (!found) return reply.code(404).send({ message: 'Persona no encontrada' });
      } catch (error) {
        return peopleError(reply, error);
      }
      return listPeople(app.db, request.membership!.workspaceId);
    },
  );

  done();
};
