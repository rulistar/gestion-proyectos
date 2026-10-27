import type { Project, Task } from '@gestion/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { ArrowRightLeft } from 'lucide-react';
import { useState, type FormEvent } from 'react';
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
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { useCurrentUser } from '@/lib/auth';
import { useMoveProject, useMoveTaskToProject } from '@/lib/moves';
import { projectTypesQueryOptions } from '@/lib/project-types';
import { projectsQueryOptions } from '@/lib/projects';

/** Espacios donde el usuario es Admin: los únicos destinos posibles entre espacios (HU-32) */
function useAdminWorkspaces() {
  const me = useCurrentUser();
  return me.workspaces.filter((workspace) => workspace.role === 'ADMIN');
}

/**
 * Mover un contenedor con sus tareas a otro espacio (HU-32). El tipo se elige del catálogo del
 * destino; se propone el que se llama igual.
 */
export function MoveProjectDialog({
  workspaceId,
  project,
}: {
  workspaceId: string;
  project: Project;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const move = useMoveProject(workspaceId, project.id);
  const targets = useAdminWorkspaces().filter((workspace) => workspace.id !== workspaceId);
  const [open, setOpen] = useState(false);
  const [targetId, setTargetId] = useState('');
  const [typeId, setTypeId] = useState('');
  const { data: types = [] } = useQuery({
    ...projectTypesQueryOptions(targetId),
    enabled: targetId !== '',
  });
  const activeTypes = types.filter((type) => !type.archived);

  function chooseTarget(id: string) {
    setTargetId(id);
    setTypeId('');
  }

  // Propuesta: el tipo del destino con el mismo nombre, o el primero con el mismo comportamiento
  const suggested =
    activeTypes.find((type) => type.name.toLowerCase() === project.type.name.toLowerCase()) ??
    activeTypes.find((type) => type.behavior === project.type.behavior);
  const chosenType = typeId || suggested?.id || '';

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    move.mutate(
      { targetWorkspaceId: targetId, typeId: chosenType },
      {
        onSuccess: () => {
          const target = targets.find((workspace) => workspace.id === targetId);
          toast.success(`"${project.name}" se movió a ${target?.name ?? 'otro espacio'}`);
          setOpen(false);
          // Primero al destino; después se refrescan los espacios (el origen ya no lo tiene)
          void navigate({
            to: '/w/$workspaceId/p/$projectId',
            params: { workspaceId: targetId, projectId: project.id },
          }).then(() => queryClient.invalidateQueries({ queryKey: ['workspaces'] }));
        },
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" disabled={targets.length === 0}>
          <ArrowRightLeft aria-hidden />
          Mover
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Mover "{project.name}" a otro espacio</DialogTitle>
          <DialogDescription>
            Se mueve con todas sus tareas. Conserva su folio, fechas e historial. Las personas y los
            tipos de tarea se buscan en el destino por nombre (si no existen, se crean).
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} noValidate className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="move-target">Espacio de destino</Label>
            <NativeSelect
              id="move-target"
              value={targetId}
              onChange={(event) => chooseTarget(event.target.value)}
            >
              <option value="">Elige un espacio…</option>
              {targets.map((workspace) => (
                <option key={workspace.id} value={workspace.id}>
                  {workspace.name}
                </option>
              ))}
            </NativeSelect>
            <p className="text-xs text-muted-foreground">
              Solo aparecen los espacios donde eres Admin.
            </p>
          </div>
          {targetId && (
            <div className="grid gap-2">
              <Label htmlFor="move-type">Tipo en el destino</Label>
              <NativeSelect
                id="move-type"
                value={chosenType}
                onChange={(event) => setTypeId(event.target.value)}
              >
                {activeTypes.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name}
                  </option>
                ))}
              </NativeSelect>
            </div>
          )}
          {move.error && (
            <p role="alert" className="text-sm text-destructive">
              {move.error.message}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!targetId || !chosenType || move.isPending}>
              {move.isPending ? 'Moviendo…' : 'Mover'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Mover una tarea a otro proyecto (HU-32): del mismo espacio (quien edita tareas) o de otro
 * espacio donde también sea Admin
 */
export function MoveTaskDialog({
  workspaceId,
  projectId,
  task,
  onMoved,
}: {
  workspaceId: string;
  projectId: string;
  task: Task;
  onMoved: () => void;
}) {
  const me = useCurrentUser();
  const move = useMoveTaskToProject(workspaceId, projectId, task.id);
  const adminHere = me.workspaces.some((w) => w.id === workspaceId && w.role === 'ADMIN');
  // El espacio actual siempre; los demás, solo si es Admin aquí y allá
  const targets = me.workspaces.filter(
    (w) => w.id === workspaceId || (adminHere && w.role === 'ADMIN'),
  );
  const [open, setOpen] = useState(false);
  const [targetId, setTargetId] = useState(workspaceId);
  const [targetProjectId, setTargetProjectId] = useState('');
  const { data: projects = [] } = useQuery(projectsQueryOptions(targetId));
  const choices = projects.filter((project) => project.id !== projectId);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    move.mutate(
      { targetWorkspaceId: targetId, targetProjectId },
      {
        onSuccess: () => {
          const target = choices.find((project) => project.id === targetProjectId);
          toast.success(`"${task.title}" se movió a ${target?.name ?? 'otro proyecto'}`);
          setOpen(false);
          onMoved();
        },
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="ghost">
          <ArrowRightLeft aria-hidden />
          Mover a otro proyecto
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Mover "{task.title}"</DialogTitle>
          <DialogDescription>
            A otro proyecto, mantenimiento o grupo de actividades. Entre espacios, su tipo y su
            responsable se buscan en el destino.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} noValidate className="grid gap-4">
          {targets.length > 1 && (
            <div className="grid gap-2">
              <Label htmlFor="move-task-workspace">Espacio</Label>
              <NativeSelect
                id="move-task-workspace"
                value={targetId}
                onChange={(event) => {
                  setTargetId(event.target.value);
                  setTargetProjectId('');
                }}
              >
                {targets.map((workspace) => (
                  <option key={workspace.id} value={workspace.id}>
                    {workspace.name}
                    {workspace.id === workspaceId ? ' (actual)' : ''}
                  </option>
                ))}
              </NativeSelect>
            </div>
          )}
          <div className="grid gap-2">
            <Label htmlFor="move-task-project">Destino</Label>
            <NativeSelect
              id="move-task-project"
              value={targetProjectId}
              onChange={(event) => setTargetProjectId(event.target.value)}
            >
              <option value="">Elige el destino…</option>
              {choices.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.folio ? `${project.folio} · ` : ''}
                  {project.name} ({project.type.name})
                </option>
              ))}
            </NativeSelect>
          </div>
          {move.error && (
            <p role="alert" className="text-sm text-destructive">
              {move.error.message}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!targetProjectId || move.isPending}>
              {move.isPending ? 'Moviendo…' : 'Mover'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
