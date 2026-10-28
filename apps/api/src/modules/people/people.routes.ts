import { createPersonSchema, updatePersonSchema } from '@gestion/shared';
import { z } from 'zod';
import type { FastifyPluginCallback, FastifyReply } from 'fastify';
import { requireAuth } from '../auth/session.js';
import { forbidden, requireMembership, requirePermission } from '../workspaces/access.js';
import {
  createPerson,
  deletePerson,
  DuplicatePersonNameError,
  listPeople,
  NotAMemberError,
  PersonNotDeletableError,
  personUsage,
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
  if (error instanceof PersonNotDeletableError) {
    return reply.code(409).send({
      message:
        'Solo se borra una persona archivada que no aparece en tareas ni proyectos y cuya cuenta ya no es miembro',
    });
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
 * dar de alta, quien crea tareas (alta rápida desde un formulario); renombrar, vincular, archivar y
 * borrar definitivamente (HU-44), el Admin
 */
export const peopleRoutes: FastifyPluginCallback = (app, _options, done) => {
  app.addHook('preHandler', requireAuth);

  app.get(BASE, { preHandler: requirePermission('project.read') }, async (request) =>
    listPeople(app.db, request.membership!.workspaceId),
  );

  app.post(BASE, { preHandler: requireMembership }, async (request, reply) => {
    // Se da de alta desde los formularios: hace falta poder crear tareas o algún contenedor
    const { permissions, role } = request.membership!;
    const canCreateSomething =
      role === 'ADMIN' ||
      permissions.tasks.create ||
      Object.values(permissions.sections).some((section) => section.create);
    if (!canCreateSomething) return forbidden(reply);
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

  // Dónde aparece una persona, para reasignarla antes de borrarla (HU-45)
  app.get(
    `${BASE}/:personId/usage`,
    { preHandler: requirePermission('member.manage') },
    async (request, reply) => {
      const params = personParamsSchema.safeParse(request.params);
      if (!params.success) return reply.code(404).send({ message: 'Persona no encontrada' });
      const usage = await personUsage(
        app.db,
        request.membership!.workspaceId,
        params.data.personId,
      );
      if (!usage) return reply.code(404).send({ message: 'Persona no encontrada' });
      return usage;
    },
  );

  app.delete(
    `${BASE}/:personId`,
    { preHandler: requirePermission('member.manage') },
    async (request, reply) => {
      const params = personParamsSchema.safeParse(request.params);
      if (!params.success) return reply.code(404).send({ message: 'Persona no encontrada' });
      try {
        const found = await deletePerson(
          app.db,
          request.membership!.workspaceId,
          params.data.personId,
        );
        if (!found) return reply.code(404).send({ message: 'Persona no encontrada' });
      } catch (error) {
        return peopleError(reply, error);
      }
      return reply.code(204).send();
    },
  );

  done();
};
