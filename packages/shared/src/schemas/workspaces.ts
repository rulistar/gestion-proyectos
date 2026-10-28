import { z } from 'zod';
import { memberAccessSchema, memberPermissionsSchema } from './member-permissions.js';

export const membershipRoleSchema = z.enum(['ADMIN', 'MEMBER', 'VIEWER']);
export type MembershipRole = z.infer<typeof membershipRoleSchema>;

export const workspaceNameSchema = z
  .string()
  .trim()
  .min(1, 'El nombre es obligatorio')
  .max(80, 'Máximo 80 caracteres');

/** Cuerpo de POST /workspaces y de PATCH /workspaces/:workspaceId (renombrar) */
export const createWorkspaceRequestSchema = z.object({ name: workspaceNameSchema });
export type CreateWorkspaceRequest = z.infer<typeof createWorkspaceRequestSchema>;

/** Un workspace visto por un miembro: incluye el rol que tiene en él */
export const workspaceSummarySchema = z.object({
  id: z.uuid(),
  name: z.string(),
  role: membershipRoleSchema,
});
export type WorkspaceSummary = z.infer<typeof workspaceSummarySchema>;

/** Respuesta de GET /workspaces */
export const workspaceListSchema = z.array(workspaceSummarySchema);

/**
 * Respuesta de GET /workspaces/:workspaceId: con mi matriz (ADR-0006), para que la web oculte lo
 * que no puedo hacer. La API lo vuelve a comprobar en cada petición.
 */
export const workspaceDetailSchema = workspaceSummarySchema.extend({ access: memberAccessSchema });
export type WorkspaceDetail = z.infer<typeof workspaceDetailSchema>;

/** Un miembro activo del workspace (por ejemplo, para elegir el responsable de una tarea) */
export const memberSchema = z.object({
  userId: z.uuid(),
  name: z.string(),
  /** Solo lo recibe quien gestiona miembros (el Admin); para los demás, null */
  email: z.string().nullable(),
  role: membershipRoleSchema,
  /** Su matriz (HU-17b): solo la recibe quien gestiona miembros; para los demás, null */
  matrix: z
    .object({ permissions: memberPermissionsSchema, selectedProjectIds: z.array(z.uuid()) })
    .nullable(),
});
export type Member = z.infer<typeof memberSchema>;

/** Respuesta de GET /workspaces/:workspaceId/members */
export const memberListSchema = z.array(memberSchema);

/** Cuerpo de PATCH /workspaces/:workspaceId/members/:userId: cambiar el rol (HU-25) */
export const updateMemberRoleRequestSchema = z.object({ role: membershipRoleSchema });
export type UpdateMemberRoleRequest = z.infer<typeof updateMemberRoleRequestSchema>;

/**
 * Cuerpo de PUT /workspaces/:workspaceId/members/:userId/permissions (HU-17b, solo el Admin): la
 * plantilla y la matriz ajustada. Con Admin la matriz se ignora (puede todo).
 */
export const updateMemberPermissionsSchema = z.object({
  role: membershipRoleSchema,
  permissions: memberPermissionsSchema,
  /** Contenedores de "Estos…"; solo se guardan los de secciones que ven "Estos…" */
  selectedProjectIds: z.array(z.uuid()).max(1000),
});
export type UpdateMemberPermissions = z.infer<typeof updateMemberPermissionsSchema>;
