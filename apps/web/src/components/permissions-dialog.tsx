import {
  type Member,
  type MembershipRole,
  type ProjectBehavior,
  type SectionPermissions,
  type TaskPermissions,
} from '@gestion/shared';
import { useQuery } from '@tanstack/react-query';
import { ShieldCheck } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { NativeSelect } from '@/components/ui/native-select';
import { peopleQueryOptions } from '@/lib/people';
import { projectsQueryOptions } from '@/lib/projects';
import { SECTIONS } from '@/lib/project-types';
import { copyPermissions, templateMatrix, type MatrixValue } from '@/lib/matrix';
import { ROLE_LABELS, roleLabel, useChangeMemberPermissions } from '@/lib/workspaces';

const BEHAVIORS: ProjectBehavior[] = ['WITH_END', 'ONGOING', 'ON_DEMAND'];

const SECTION_VIEW: Record<SectionPermissions['view'], string> = {
  OWN: 'Solo los suyos',
  ALL: 'Todos',
  SELECTED: 'Estos…',
};
const SECTION_UPDATE: Record<SectionPermissions['update'], string> = {
  NONE: 'Ninguno',
  OWN: 'Los suyos',
  VISIBLE: 'Los que ve',
};
const SECTION_REMOVE: Record<SectionPermissions['remove'], string> = {
  NONE: 'Ninguno',
  OWN: 'Los suyos',
  EDITABLE: 'Los que modifica',
};
const TASK_VIEW: Record<TaskPermissions['view'], string> = {
  MINE: 'Las suyas',
  VISIBLE: 'Todas las de lo que ve',
};
const TASK_UPDATE: Record<TaskPermissions['update'], string> = {
  NONE: 'Ninguna',
  MINE: 'Las suyas',
  VISIBLE: 'Las que ve',
};
const TASK_REMOVE: Record<TaskPermissions['remove'], string> = {
  NONE: 'Ninguna',
  MINE: 'Las suyas',
  EDITABLE: 'Las que modifica',
};

function Choice<T extends string>({
  label,
  value,
  options,
  disabled,
  onChange,
}: {
  label: string;
  value: T;
  options: Record<T, string>;
  disabled: boolean;
  onChange: (value: T) => void;
}) {
  return (
    <NativeSelect
      aria-label={label}
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value as T)}
      className="h-8 w-full min-w-36"
    >
      {(Object.entries(options) as [T, string][]).map(([option, text]) => (
        <option key={option} value={option}>
          {text}
        </option>
      ))}
    </NativeSelect>
  );
}

function Row({ title, children }: { title: string; children: ReactNode }) {
  return (
    <tr className="border-b last:border-0">
      <th scope="row" className="py-2 pr-3 text-left font-medium whitespace-nowrap">
        {title}
      </th>
      {children}
    </tr>
  );
}

/**
 * Permisos de un miembro (HU-17b, ADR-0006): plantilla, matriz por sección y la lista "Estos…".
 * Solo el Admin; la API valida y aplica todo.
 */
export function PermissionsDialog({
  workspaceId,
  member,
}: {
  workspaceId: string;
  member: Member & { matrix: NonNullable<Member['matrix']> };
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" aria-label={`Permisos de ${member.name}`}>
          <ShieldCheck aria-hidden />
          Permisos
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        {/* Se monta al abrir: siempre parte de lo guardado */}
        {open && (
          <PermissionsForm
            workspaceId={workspaceId}
            member={member}
            onDone={() => setOpen(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function PermissionsForm({
  workspaceId,
  member,
  onDone,
}: {
  workspaceId: string;
  member: Member & { matrix: NonNullable<Member['matrix']> };
  onDone: () => void;
}) {
  const save = useChangeMemberPermissions(workspaceId);
  const [value, setValue] = useState<MatrixValue>(() => ({
    role: member.role,
    permissions: copyPermissions(member.matrix.permissions),
    selected: new Set(member.matrix.selectedProjectIds),
  }));
  const [watched, setWatched] = useState<ReadonlySet<string>>(
    () => new Set(member.matrix.watchedPersonIds),
  );

  function handleSave() {
    save.mutate(
      {
        userId: member.userId,
        role: value.role,
        permissions: value.permissions,
        selectedProjectIds: [...value.selected],
        watchedPersonIds: [...watched],
      },
      {
        onSuccess: () => {
          toast.success(`Se guardaron los permisos de ${member.name}`);
          onDone();
        },
        onError: (error) => toast.error(error.message),
      },
    );
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Permisos de {member.name}</DialogTitle>
        <MatrixHint />
      </DialogHeader>
      <MatrixEditor
        workspaceId={workspaceId}
        value={value}
        onChange={setValue}
        disabled={save.isPending}
      />
      {value.role !== 'ADMIN' && (
        <WatchedPeopleEditor
          workspaceId={workspaceId}
          member={member}
          value={watched}
          onChange={setWatched}
          disabled={save.isPending}
        />
      )}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onDone} disabled={save.isPending}>
          Cancelar
        </Button>
        <Button onClick={handleSave} disabled={save.isPending}>
          Guardar permisos
        </Button>
      </div>
    </>
  );
}

/**
 * Personas cuyo trabajo puede ver, en solo lectura (HU-52): sus tareas (donde son Responsables)
 * y los contenedores donde están. Se eligen del catálogo, tengan o no cuenta.
 */
function WatchedPeopleEditor({
  workspaceId,
  member,
  value,
  onChange,
  disabled,
}: {
  workspaceId: string;
  member: Member;
  value: ReadonlySet<string>;
  onChange: (value: ReadonlySet<string>) => void;
  disabled: boolean;
}) {
  const { data: people = [] } = useQuery(peopleQueryOptions(workspaceId));
  // Su propia persona no: lo suyo ya lo ve. Las archivadas solo si ya estaban elegidas
  const choices = people.filter(
    (person) => person.userId !== member.userId && (!person.archived || value.has(person.id)),
  );

  function toggle(id: string) {
    const next = new Set(value);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(next);
  }

  return (
    <fieldset disabled={disabled} className="grid gap-2 rounded-md border p-3">
      <legend className="px-1 text-sm font-semibold">Puede ver el trabajo de</legend>
      <p className="text-xs text-muted-foreground">
        Ve, sin poder modificarlas, las tareas donde estas personas son Responsables (también en Mi
        trabajo) y los contenedores donde están. Ej.: si marcas a Luis, verá las tareas de Luis
        aunque su matriz diga «las suyas».
      </p>
      {choices.length === 0 ? (
        <p className="text-sm text-muted-foreground">No hay otras personas en el catálogo.</p>
      ) : (
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {choices.map((person) => (
            <label key={person.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={value.has(person.id)}
                onChange={() => toggle(person.id)}
                className="size-4 accent-primary"
              />
              {person.name}
              {person.archived ? ' (archivada)' : ''}
            </label>
          ))}
        </div>
      )}
    </fieldset>
  );
}

/** Qué significan "los suyos" y "las suyas" */
export function MatrixHint() {
  return (
    <DialogDescription>
      Elige una plantilla y ajústala casilla por casilla. «Los suyos» son los que creó; «las suyas»,
      las tareas que creó o donde es Responsable. Lo que creó siempre lo ve.
    </DialogDescription>
  );
}

/**
 * Editor de plantilla + matriz + lista "Estos…" de un espacio (HU-17b; también al invitar, HU-17c).
 * Controlado: recibe el valor y avisa cada cambio.
 */
export function MatrixEditor({
  workspaceId,
  value,
  onChange,
  disabled = false,
}: {
  workspaceId: string;
  value: MatrixValue;
  onChange: (value: MatrixValue) => void;
  disabled?: boolean;
}) {
  const { data: projects = [] } = useQuery(projectsQueryOptions(workspaceId));
  const { role, permissions, selected } = value;
  const isAdmin = role === 'ADMIN';

  function setSection(behavior: ProjectBehavior, change: Partial<SectionPermissions>) {
    onChange({
      ...value,
      permissions: {
        ...permissions,
        sections: {
          ...permissions.sections,
          [behavior]: { ...permissions.sections[behavior], ...change },
        },
      },
    });
  }

  function setTasks(change: Partial<TaskPermissions>) {
    onChange({
      ...value,
      permissions: { ...permissions, tasks: { ...permissions.tasks, ...change } },
    });
  }

  function toggleProject(id: string, checked: boolean) {
    const next = new Set(selected);
    if (checked) next.add(id);
    else next.delete(id);
    onChange({ ...value, selected: next });
  }

  const selectedSections = BEHAVIORS.filter(
    (behavior) => !isAdmin && permissions.sections[behavior].view === 'SELECTED',
  );

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm font-medium">
          Plantilla
          <NativeSelect
            value={role}
            disabled={disabled}
            onChange={(event) => onChange(templateMatrix(event.target.value as MembershipRole))}
            className="h-8 w-36"
          >
            {Object.entries(ROLE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </NativeSelect>
        </label>
        <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-semibold text-accent-foreground">
          {roleLabel(role, permissions)}
        </span>
      </div>

      {isAdmin ? (
        <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
          El Admin puede todo en este espacio, incluidos Miembros, Personas, Configuración y la
          papelera.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="py-2 pr-3 font-medium" />
                <th className="py-2 pr-3 font-medium">Ver</th>
                <th className="py-2 pr-3 font-medium">Crear</th>
                <th className="py-2 pr-3 font-medium">Modificar</th>
                <th className="py-2 font-medium">Dar de baja y restaurar</th>
              </tr>
            </thead>
            <tbody>
              {BEHAVIORS.map((behavior) => {
                const section = permissions.sections[behavior];
                const title = SECTIONS[behavior].title;
                return (
                  <Row key={behavior} title={title}>
                    <td className="py-2 pr-3">
                      <Choice
                        label={`${title}: ver`}
                        value={section.view}
                        options={SECTION_VIEW}
                        disabled={disabled}
                        onChange={(view) => setSection(behavior, { view })}
                      />
                    </td>
                    <td className="py-2 pr-3">
                      <input
                        type="checkbox"
                        aria-label={`${title}: crear`}
                        checked={section.create}
                        disabled={disabled}
                        onChange={(event) => setSection(behavior, { create: event.target.checked })}
                        className="size-4 accent-primary"
                      />
                    </td>
                    <td className="py-2 pr-3">
                      <Choice
                        label={`${title}: modificar`}
                        value={section.update}
                        options={SECTION_UPDATE}
                        disabled={disabled}
                        onChange={(update) => setSection(behavior, { update })}
                      />
                    </td>
                    <td className="py-2">
                      <Choice
                        label={`${title}: dar de baja y restaurar`}
                        value={section.remove}
                        options={SECTION_REMOVE}
                        disabled={disabled}
                        onChange={(remove) => setSection(behavior, { remove })}
                      />
                    </td>
                  </Row>
                );
              })}
              <Row title="Tareas">
                <td className="py-2 pr-3">
                  <Choice
                    label="Tareas: ver"
                    value={permissions.tasks.view}
                    options={TASK_VIEW}
                    disabled={disabled}
                    onChange={(view) => setTasks({ view })}
                  />
                </td>
                <td className="py-2 pr-3">
                  <input
                    type="checkbox"
                    aria-label="Tareas: crear"
                    checked={permissions.tasks.create}
                    disabled={disabled}
                    onChange={(event) => setTasks({ create: event.target.checked })}
                    className="size-4 accent-primary"
                  />
                </td>
                <td className="py-2 pr-3">
                  <Choice
                    label="Tareas: modificar"
                    value={permissions.tasks.update}
                    options={TASK_UPDATE}
                    disabled={disabled}
                    onChange={(update) => setTasks({ update })}
                  />
                </td>
                <td className="py-2">
                  <Choice
                    label="Tareas: dar de baja y restaurar"
                    value={permissions.tasks.remove}
                    options={TASK_REMOVE}
                    disabled={disabled}
                    onChange={(remove) => setTasks({ remove })}
                  />
                </td>
              </Row>
            </tbody>
          </table>
        </div>
      )}

      {/* La lista "Estos…" de cada sección que la usa */}
      {selectedSections.map((behavior) => {
        const options = projects.filter((project) => project.type.behavior === behavior);
        return (
          <fieldset key={behavior} className="grid gap-2 rounded-md border p-3">
            <legend className="px-1 text-sm font-medium">
              {SECTIONS[behavior].title} que ve («Estos…»)
            </legend>
            {options.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay ninguno en el espacio.</p>
            ) : (
              <div className="grid max-h-48 gap-1 overflow-y-auto sm:grid-cols-2">
                {options.map((project) => (
                  <label key={project.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={selected.has(project.id)}
                      disabled={disabled}
                      onChange={(event) => toggleProject(project.id, event.target.checked)}
                      className="size-4 accent-primary"
                    />
                    <span className="truncate">
                      {project.folio && (
                        <span className="text-muted-foreground">{project.folio} · </span>
                      )}
                      {project.name}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </fieldset>
        );
      })}
    </div>
  );
}
