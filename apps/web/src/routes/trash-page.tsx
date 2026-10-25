import { roleHasPermission, type TrashItem } from '@gestion/shared';
import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { getRouteApi, Link } from '@tanstack/react-router';
import { FolderKanban, ListChecks, RotateCcw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { trashQueryOptions, usePurgeFromTrash, useRestoreFromTrash } from '@/lib/trash';
import { workspaceQueryOptions } from '@/lib/workspaces';

// Es el id de la ruta (no la URL): cuelga de la ruta sin URL "app", de ahí el /app
const route = getRouteApi('/app/w/$workspaceId/papelera');

const dateTimeFormat = new Intl.DateTimeFormat('es-MX', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

/** Papelera del espacio (HU-15): restaurar o borrar definitivamente. Solo para el Admin */
export function TrashPage() {
  const { workspaceId } = route.useParams();
  const { data: workspace } = useSuspenseQuery(workspaceQueryOptions(workspaceId));
  const canManage = roleHasPermission(workspace.role, 'trash.manage');
  // Sin permiso ni se pide: la API respondería 403
  const { data: items = [], isPending } = useQuery({
    ...trashQueryOptions(workspaceId),
    enabled: canManage,
  });

  if (!canManage) {
    return (
      <Card className="mx-auto mt-8 max-w-md">
        <CardHeader>
          <CardTitle>Solo para el Admin</CardTitle>
          <CardDescription>
            La papelera la gestiona el Admin de este espacio de trabajo.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link to="/w/$workspaceId" params={{ workspaceId }} className="text-sm font-medium">
            Volver a los proyectos
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Papelera</h1>
        <p className="mt-1 text-muted-foreground">
          Lo dado de baja en {workspace.name}. Restáuralo si fue un error; bórralo definitivamente
          si ya no lo necesitas.
        </p>
      </div>

      <Card>
        <CardContent>
          {isPending ? (
            <p className="text-sm text-muted-foreground">Cargando…</p>
          ) : items.length === 0 ? (
            <div className="grid justify-items-center gap-2 py-8 text-center">
              <Trash2 aria-hidden className="size-8 text-muted-foreground" />
              <p className="font-medium">La papelera está vacía</p>
              <p className="text-sm text-muted-foreground">
                Lo que des de baja aparecerá aquí y se podrá recuperar.
              </p>
            </div>
          ) : (
            <ul className="divide-y rounded-md border">
              {items.map((item) => (
                <TrashRow key={`${item.kind}-${item.id}`} workspaceId={workspaceId} item={item} />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function TrashRow({ workspaceId, item }: { workspaceId: string; item: TrashItem }) {
  const restore = useRestoreFromTrash(workspaceId);
  const purge = usePurgeFromTrash(workspaceId);
  const isProject = item.kind === 'project';
  const Icon = isProject ? FolderKanban : ListChecks;
  const target = { kind: item.kind, id: item.id };

  const context = isProject
    ? `Proyecto · ${item.taskCount === 1 ? '1 tarea' : `${item.taskCount} tareas`}`
    : `Tarea de ${item.projectName}`;
  const who = `Dado de baja por ${item.deletedByName ?? 'el sistema'} el ${dateTimeFormat.format(new Date(item.deletedAt))}`;

  function handleRestore() {
    restore.mutate(target, {
      onSuccess: () => toast.success(`"${item.name}" se restauró`),
      onError: (error) => toast.error(error.message),
    });
  }

  function handlePurge() {
    purge.mutate(target, {
      onSuccess: () => toast.success(`"${item.name}" se borró definitivamente`),
      onError: (error) => toast.error(error.message),
    });
  }

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <span
          aria-hidden
          className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground"
        >
          <Icon className="size-4" />
        </span>
        <div className="min-w-0">
          <p className="truncate font-medium">{item.name}</p>
          <p className="text-sm text-muted-foreground">{context}</p>
          <p className="text-xs text-muted-foreground">{who}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={restore.isPending || purge.isPending}
          onClick={handleRestore}
        >
          <RotateCcw aria-hidden />
          Restaurar
        </Button>
        <ConfirmDialog
          trigger={
            <Button
              variant="destructive"
              size="sm"
              disabled={restore.isPending || purge.isPending}
              aria-label={`Borrar definitivamente "${item.name}"`}
            >
              <Trash2 aria-hidden />
              Borrar
            </Button>
          }
          title={`¿Borrar definitivamente "${item.name}"?`}
          description={
            isProject
              ? `Se borrará el proyecto con sus ${item.taskCount} tareas. Esto no se puede deshacer.`
              : 'Se borrará la tarea. Esto no se puede deshacer.'
          }
          confirmLabel="Borrar definitivamente"
          typeToConfirm={item.name}
          onConfirm={handlePurge}
        />
      </div>
    </li>
  );
}
