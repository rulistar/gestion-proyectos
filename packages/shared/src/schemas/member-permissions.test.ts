import { describe, expect, it } from 'vitest';
import {
  canCreateContainer,
  canCreateTaskIn,
  canRemoveContainer,
  canRemoveTask,
  canUpdateContainer,
  canUpdateTask,
  canUseTrash,
  canViewTask,
  matchesTemplate,
  memberPermissionsSchema,
  PERMISSION_TEMPLATES,
  sectionCanView,
  type MemberAccess,
  type MemberPermissions,
} from './member-permissions.js';

const ME = 'yo';
const OTHER = 'otro';

function access(permissions: MemberPermissions, extra: Partial<MemberAccess> = {}): MemberAccess {
  return {
    userId: ME,
    personId: 'mi-persona',
    role: 'MEMBER',
    permissions,
    selectedProjectIds: [],
    watchedPersonIds: [],
    ...extra,
  };
}

const mine = {
  id: 'p-mio',
  createdById: ME,
  behavior: 'WITH_END' as const,
  scope: 'WORK' as const,
};
const theirs = {
  id: 'p-ajeno',
  createdById: OTHER,
  behavior: 'WITH_END' as const,
  scope: 'WORK' as const,
};
const theirMtto = {
  id: 'm-ajeno',
  createdById: OTHER,
  behavior: 'ONGOING' as const,
  scope: 'WORK' as const,
};

const member = access(PERMISSION_TEMPLATES.MEMBER);

describe('plantillas (ADR-0006 §2)', () => {
  it('las tres plantillas son matrices válidas', () => {
    for (const template of Object.values(PERMISSION_TEMPLATES)) {
      expect(memberPermissionsSchema.parse(template)).toEqual(template);
    }
  });

  it('Miembro: ve y modifica solo lo suyo; no crea contenedores', () => {
    expect(sectionCanView(member, mine)).toBe(true);
    expect(sectionCanView(member, theirs)).toBe(false);
    expect(canUpdateContainer(member, mine)).toBe(true);
    expect(canUpdateContainer(member, theirs)).toBe(false);
    expect(canRemoveContainer(member, mine)).toBe(false);
    expect(canCreateContainer(member, 'WITH_END')).toBe(false);
  });

  it('Lector: ve todo y no modifica nada, ni sus propias tareas', () => {
    const viewer = access(PERMISSION_TEMPLATES.VIEWER, { role: 'VIEWER' });
    const assigned = { createdById: OTHER, responsiblePersonId: 'mi-persona', project: theirs };
    expect(sectionCanView(viewer, theirs)).toBe(true);
    expect(canUpdateContainer(viewer, theirs)).toBe(false);
    expect(canUpdateTask(viewer, assigned)).toBe(false);
  });

  it('el Admin puede todo, aunque su matriz diga otra cosa', () => {
    const admin = access(PERMISSION_TEMPLATES.MEMBER, { role: 'ADMIN' });
    expect(canRemoveContainer(admin, theirs)).toBe(true);
    expect(canCreateContainer(admin, 'ONGOING')).toBe(true);
  });
});

describe('ver: solo los míos, todos o "Estos…"', () => {
  const custom: MemberPermissions = {
    ...PERMISSION_TEMPLATES.MEMBER,
    sections: {
      ...PERMISSION_TEMPLATES.MEMBER.sections,
      WITH_END: { view: 'SELECTED', create: false, update: 'VISIBLE', remove: 'EDITABLE' },
      ONGOING: { view: 'ALL', create: true, update: 'NONE', remove: 'NONE' },
    },
  };
  const someone = access(custom, { selectedProjectIds: [theirs.id] });

  it('"Estos…" ve los de la lista (y los suyos); cada sección por separado', () => {
    expect(sectionCanView(someone, theirs)).toBe(true);
    expect(sectionCanView(someone, { ...theirs, id: 'otro-proyecto' })).toBe(false);
    expect(sectionCanView(someone, theirMtto)).toBe(true);
  });

  it('ver todos sin modificar = solo lectura', () => {
    expect(canUpdateContainer(someone, theirMtto)).toBe(false);
    expect(canCreateContainer(someone, 'ONGOING')).toBe(true);
  });

  it('dar de baja "los que puede modificar"', () => {
    expect(canRemoveContainer(someone, theirs)).toBe(true);
    expect(canRemoveContainer(someone, { ...theirs, id: 'otro-proyecto' })).toBe(false);
  });
});

describe('tareas: "las mías" = las que creé o donde soy Responsable', () => {
  const createdByMe = { createdById: ME, responsiblePersonId: null, project: theirs };
  const assignedToMe = { createdById: OTHER, responsiblePersonId: 'mi-persona', project: theirs };
  const others = { createdById: OTHER, responsiblePersonId: 'alguien', project: mine };

  it('el Miembro ve las de otros en su proyecto (HU-53), pero solo modifica las suyas', () => {
    expect(canViewTask(member, createdByMe)).toBe(true);
    expect(canUpdateTask(member, assignedToMe)).toBe(true);
    expect(canViewTask(member, others)).toBe(true);
    expect(canUpdateTask(member, others)).toBe(false);
    expect(canRemoveTask(member, createdByMe)).toBe(false);
  });

  it('con "todas las de lo que ve", ve las de los contenedores visibles', () => {
    const wider = access({
      ...PERMISSION_TEMPLATES.MEMBER,
      tasks: { view: 'VISIBLE', create: true, update: 'MINE', remove: 'MINE' },
    });
    expect(canViewTask(wider, others)).toBe(true);
    expect(canUpdateTask(wider, others)).toBe(false);
    expect(canRemoveTask(wider, createdByMe)).toBe(true);
  });

  it('agrega tareas donde ve el contenedor o ya tiene una tarea suya', () => {
    expect(canCreateTaskIn(member, mine, false)).toBe(true);
    expect(canCreateTaskIn(member, theirs, false)).toBe(false);
    expect(canCreateTaskIn(member, theirs, true)).toBe(true);
  });
});

describe('pantalla de permisos (HU-17b)', () => {
  it('"ajustado" cuando la matriz ya no es la de su plantilla', () => {
    const adjusted = memberPermissionsSchema.parse(
      JSON.parse(JSON.stringify(PERMISSION_TEMPLATES.MEMBER)),
    );
    expect(matchesTemplate('MEMBER', adjusted)).toBe(true);

    adjusted.sections.ONGOING.view = 'ALL';
    expect(matchesTemplate('MEMBER', adjusted)).toBe(false);
    expect(matchesTemplate('VIEWER', PERMISSION_TEMPLATES.MEMBER)).toBe(false);
    // El Admin puede todo: nunca está "ajustado"
    expect(matchesTemplate('ADMIN', PERMISSION_TEMPLATES.VIEWER)).toBe(true);
  });

  it('usa la papelera quien puede dar de baja algo', () => {
    const removesTasks = memberPermissionsSchema.parse(
      JSON.parse(JSON.stringify(PERMISSION_TEMPLATES.MEMBER)),
    );
    removesTasks.tasks.remove = 'MINE';

    expect(canUseTrash(member)).toBe(false);
    expect(canUseTrash(access(PERMISSION_TEMPLATES.VIEWER))).toBe(false);
    expect(canUseTrash(access(removesTasks))).toBe(true);
    expect(canUseTrash(access(PERMISSION_TEMPLATES.VIEWER, { role: 'ADMIN' }))).toBe(true);
  });
});

describe('ver el trabajo de otra persona (HU-52)', () => {
  // Solo ve sus tareas por su matriz: lo de Luis lo ve por seguirlo
  const soloLasMias = {
    sections: PERMISSION_TEMPLATES.VIEWER.sections,
    tasks: { ...PERMISSION_TEMPLATES.VIEWER.tasks, view: 'MINE' as const },
    workOnly: false,
  };
  const lector = access(soloLasMias, { watchedPersonIds: ['luis'] });
  const deLuis = { createdById: 'otro', responsiblePersonId: 'luis', project: theirs };
  const dePedro = { createdById: 'otro', responsiblePersonId: 'pedro', project: theirs };

  it('ve las tareas donde Luis es Responsable, pero no las de Pedro', () => {
    expect(canViewTask(lector, deLuis)).toBe(true);
    expect(canViewTask(lector, dePedro)).toBe(false);
  });

  it('solo las ve: no las modifica ni las da de baja, aunque su permiso sea "las que ve"', () => {
    const miembro = access(
      {
        sections: PERMISSION_TEMPLATES.MEMBER.sections,
        tasks: { view: 'MINE', create: true, update: 'VISIBLE', remove: 'EDITABLE' },
        workOnly: false,
      },
      { watchedPersonIds: ['luis'] },
    );
    expect(canViewTask(miembro, deLuis)).toBe(true);
    expect(canUpdateTask(miembro, deLuis)).toBe(false);
    expect(canRemoveTask(miembro, deLuis)).toBe(false);
  });
});

describe('solo trabajo (HU-53)', () => {
  const lector = access(PERMISSION_TEMPLATES.VIEWER, { role: 'VIEWER' });
  const gimnasio = { ...theirs, id: 'p-gimnasio', scope: 'PERSONAL' as const };
  const miGimnasio = { ...gimnasio, createdById: ME };

  it('el Lector ve «Certificación Linux» (Trabajo) pero no «Gimnasio» (Personal) ni sus tareas', () => {
    expect(sectionCanView(lector, theirs)).toBe(true);
    expect(sectionCanView(lector, gimnasio)).toBe(false);
    expect(
      canViewTask(lector, { createdById: OTHER, responsiblePersonId: null, project: gimnasio }),
    ).toBe(false);
  });

  it('lo suyo en un contenedor Personal sí lo ve', () => {
    expect(sectionCanView(lector, miGimnasio)).toBe(true);
    const suya = { createdById: OTHER, responsiblePersonId: 'mi-persona', project: gimnasio };
    expect(canViewTask(lector, suya)).toBe(true);
  });

  it('tampoco ve lo Personal de una persona que sigue', () => {
    const sigue = access(PERMISSION_TEMPLATES.VIEWER, { watchedPersonIds: ['luis'] });
    const deLuis = { createdById: OTHER, responsiblePersonId: 'luis', project: gimnasio };
    expect(canViewTask(sigue, deLuis)).toBe(false);
  });

  it('sin «Solo trabajo» (Miembro) ve lo Personal como lo demás', () => {
    const verTodo = access({ ...PERMISSION_TEMPLATES.VIEWER, workOnly: false });
    expect(sectionCanView(verTodo, gimnasio)).toBe(true);
    expect(matchesTemplate('VIEWER', verTodo.permissions)).toBe(false);
  });

  it('las matrices guardadas antes de HU-53 se leen sin «Solo trabajo»', () => {
    const { workOnly: _omitida, ...antes } = PERMISSION_TEMPLATES.VIEWER;
    expect(memberPermissionsSchema.parse(antes).workOnly).toBe(false);
  });
});

describe('Miembro (HU-53)', () => {
  it('ve las tareas de los contenedores que ve, pero solo modifica las suyas', () => {
    const ajena = { createdById: OTHER, responsiblePersonId: 'otra', project: mine };
    expect(canViewTask(member, ajena)).toBe(true);
    expect(canUpdateTask(member, ajena)).toBe(false);
    expect(canUpdateTask(member, { ...ajena, responsiblePersonId: 'mi-persona' })).toBe(true);
  });
});
