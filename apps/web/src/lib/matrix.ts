import { PERMISSION_TEMPLATES, type MemberPermissions, type MembershipRole } from '@gestion/shared';

/** Plantilla, matriz y lista "Estos…" que se editan juntas (HU-17b, HU-17c) */
export interface MatrixValue {
  role: MembershipRole;
  permissions: MemberPermissions;
  selected: ReadonlySet<string>;
}

/** Copia sin referencias compartidas: en las plantillas, las tres secciones son el mismo objeto */
export function copyPermissions(permissions: MemberPermissions): MemberPermissions {
  return {
    sections: {
      WITH_END: { ...permissions.sections.WITH_END },
      ONGOING: { ...permissions.sections.ONGOING },
      ON_DEMAND: { ...permissions.sections.ON_DEMAND },
    },
    tasks: { ...permissions.tasks },
    workOnly: permissions.workOnly,
  };
}

/** La matriz de una plantilla, sin ajustes ni lista "Estos…" */
export function templateMatrix(role: MembershipRole): MatrixValue {
  return { role, permissions: copyPermissions(PERMISSION_TEMPLATES[role]), selected: new Set() };
}
