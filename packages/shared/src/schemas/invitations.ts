import { z } from 'zod';
import { emailSchema } from './auth.js';
import { membershipRoleSchema } from './workspaces.js';

/** Decisión del PO (2026-10-24): el enlace es de un solo uso y caduca a las 48 horas */
export const INVITATION_TTL_HOURS = 48;

/** Cuerpo de POST /workspaces/:workspaceId/invitations (HU-04) */
export const createInvitationRequestSchema = z.object({
  email: emailSchema,
  role: membershipRoleSchema,
});
export type CreateInvitationRequest = z.infer<typeof createInvitationRequestSchema>;

/** Invitación pendiente (ni aceptada, ni revocada, ni caducada) */
export const invitationSchema = z.object({
  id: z.uuid(),
  email: z.string(),
  role: membershipRoleSchema,
  expiresAt: z.iso.datetime(),
});
export type Invitation = z.infer<typeof invitationSchema>;

export const invitationListSchema = z.array(invitationSchema);

/**
 * Respuesta al crear: el token viaja **solo esta vez**; en la BD queda únicamente su hash.
 * La web arma el enlace con él para que el Admin lo copie y lo envíe.
 */
export const createInvitationResponseSchema = z.object({
  invitation: invitationSchema,
  token: z.string(),
});
export type CreateInvitationResponse = z.infer<typeof createInvitationResponseSchema>;
