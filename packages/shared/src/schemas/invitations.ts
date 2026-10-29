import { z } from 'zod';
import { currentUserSchema, emailSchema, passwordSchema, personNameSchema } from './auth.js';
import { memberPermissionsSchema } from './member-permissions.js';
import { membershipRoleSchema } from './workspaces.js';

/** Decisión del PO (2026-10-24): el enlace es de un solo uso y caduca a las 48 horas */
export const INVITATION_TTL_HOURS = 48;

/** Lo que recibe en un espacio (HU-17c, ADR-0006 §4): plantilla, matriz y lista "Estos…" */
export const invitationGrantSchema = z.object({
  role: membershipRoleSchema,
  /** Matriz ajustada; sin ella, la de la plantilla del rol */
  permissions: memberPermissionsSchema.optional(),
  /** Contenedores de "Estos…"; solo cuentan los de secciones que ven "Estos…" */
  selectedProjectIds: z.array(z.uuid()).max(1000).default([]),
});
export type InvitationGrantInput = z.infer<typeof invitationGrantSchema>;

/**
 * Cuerpo de POST /workspaces/:workspaceId/invitations (HU-04): el correo, lo que recibe en este
 * espacio y, si se quiere, en otros donde quien invita también es Admin (HU-17c)
 */
export const createInvitationRequestSchema = invitationGrantSchema.extend({
  email: emailSchema,
  otherWorkspaces: z
    .array(invitationGrantSchema.extend({ workspaceId: z.uuid() }))
    .max(50)
    .default([]),
});
/** Lo que envía la web (con valores por omisión sin llenar) */
export type CreateInvitationRequest = z.input<typeof createInvitationRequestSchema>;
/** Lo que recibe la API ya validado */
export type CreateInvitationData = z.infer<typeof createInvitationRequestSchema>;

/** Un espacio de la invitación, como se muestra */
const invitationWorkspaceSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  role: membershipRoleSchema,
});

/** Invitación pendiente (ni aceptada, ni revocada, ni caducada) */
export const invitationSchema = z.object({
  id: z.uuid(),
  email: z.string(),
  /** Rol en el espacio desde el que se consulta */
  role: membershipRoleSchema,
  expiresAt: z.iso.datetime(),
  /** Todos los espacios a los que entra al aceptar (HU-17c) */
  workspaces: z.array(invitationWorkspaceSchema),
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

// --- Aceptar una invitación (HU-01) ---
// El token viaja siempre en el cuerpo (POST), nunca en la URL: así no queda en registros.

/** Token del enlace: 32 bytes en base64url (43 caracteres) */
const invitationTokenSchema = z.string().regex(/^[\w-]{43}$/, 'Enlace no válido');

/** Cuerpo de POST /invitations/preview y POST /invitations/accept */
export const invitationTokenRequestSchema = z.object({ token: invitationTokenSchema });
export type InvitationTokenRequest = z.infer<typeof invitationTokenRequestSchema>;

/** Lo que ve la persona invitada antes de aceptar */
export const invitationPreviewSchema = z.object({
  workspaceName: z.string(),
  email: z.string(),
  role: membershipRoleSchema,
  /** Todos los espacios a los que entra, con su rol (HU-17c) */
  workspaces: z.array(invitationWorkspaceSchema.omit({ id: true })),
  /** Si ese correo ya tiene cuenta: entonces inicia sesión en vez de crear una */
  hasAccount: z.boolean(),
});
export type InvitationPreview = z.infer<typeof invitationPreviewSchema>;

/** Cuerpo de POST /invitations/register: crear la cuenta al aceptar */
export const registerFromInvitationRequestSchema = z.object({
  token: invitationTokenSchema,
  name: personNameSchema,
  password: passwordSchema,
});
export type RegisterFromInvitationRequest = z.infer<typeof registerFromInvitationRequestSchema>;

/** Respuesta al aceptar: la sesión queda iniciada y la web lleva al workspace */
export const acceptInvitationResponseSchema = z.object({
  workspaceId: z.uuid(),
  user: currentUserSchema,
});
export type AcceptInvitationResponse = z.infer<typeof acceptInvitationResponseSchema>;
