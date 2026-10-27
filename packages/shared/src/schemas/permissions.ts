import type { MembershipRole } from './workspaces.js';

/**
 * Catálogo de permisos (ADR-0002 §5). Vive en código, no en la BD: la web lo usa para
 * mostrar u ocultar botones y la API para autorizar cada endpoint (lo que cuenta es la API).
 */
export const PERMISSIONS = [
  'project.read',
  'project.create',
  'project.update',
  'project.delete',
  'task.create',
  'task.update',
  'task.delete',
  'data.export',
  'data.import',
  'member.manage',
  'workspace.update',
  'trash.manage',
  /** Tipos de contenedor y de tarea, campos de detalle (ADR-0004) */
  'catalog.manage',
  /** Mover contenedores y tareas a otro espacio (HU-32): solo Admin, en origen y destino */
  'project.move',
  'integration.manage',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

/** Permisos por defecto de cada rol. Los ajustes por usuario llegan con HU-17 */
const ROLE_PERMISSIONS: Record<MembershipRole, ReadonlySet<Permission>> = {
  ADMIN: new Set(PERMISSIONS),
  MEMBER: new Set([
    'project.read',
    'project.create',
    'project.update',
    'task.create',
    'task.update',
    'task.delete',
    'data.export',
  ]),
  VIEWER: new Set(['project.read']),
};

export function roleHasPermission(role: MembershipRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].has(permission);
}
