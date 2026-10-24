import { roleHasPermission } from '@gestion/shared';
import { useSuspenseQuery } from '@tanstack/react-query';
import { getRouteApi, Link } from '@tanstack/react-router';
import { ProjectForm } from '@/components/project-form';
import { ProjectStatusBadge } from '@/components/project-status-badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { projectQueryOptions, useUpdateProject } from '@/lib/projects';
import { workspaceQueryOptions } from '@/lib/workspaces';

// Es el id de la ruta (no la URL): cuelga de la ruta sin URL "app", de ahí el /app
const route = getRouteApi('/app/w/$workspaceId/p/$projectId');

/** Un proyecto: sus datos, editables si mi rol lo permite (HU-05). Las tareas llegan con HU-08 */
export function ProjectPage() {
  const { workspaceId, projectId } = route.useParams();
  const { data: workspace } = useSuspenseQuery(workspaceQueryOptions(workspaceId));
  const { data: project } = useSuspenseQuery(projectQueryOptions(workspaceId, projectId));
  const updateProject = useUpdateProject(workspaceId, projectId);
  const canEdit = roleHasPermission(workspace.role, 'project.update');

  return (
    <div className="grid gap-4">
      <div>
        <Link
          to="/w/$workspaceId"
          params={{ workspaceId }}
          className="text-sm text-muted-foreground hover:underline"
        >
          ← {workspace.name}
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold">{project.name}</h1>
          <ProjectStatusBadge status={project.status} />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Datos del proyecto</CardTitle>
        </CardHeader>
        <CardContent>
          {/* key: si los datos cambian (al guardar), el formulario se vuelve a crear con ellos */}
          <ProjectForm
            key={JSON.stringify(project)}
            project={project}
            submitLabel="Guardar cambios"
            readOnly={!canEdit}
            isPending={updateProject.isPending}
            error={updateProject.error?.message}
            status={
              updateProject.isSuccess && (
                <p role="status" className="text-sm text-muted-foreground">
                  Cambios guardados
                </p>
              )
            }
            onSubmit={(data) => updateProject.mutate(data)}
          />
        </CardContent>
      </Card>
    </div>
  );
}
