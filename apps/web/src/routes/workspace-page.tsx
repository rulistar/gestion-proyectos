import { daysRemainingLabel, roleHasPermission } from '@gestion/shared';
import { useSuspenseQuery } from '@tanstack/react-query';
import { getRouteApi, Link } from '@tanstack/react-router';
import { ProgressBar } from '@/components/progress-bar';
import { ProjectForm } from '@/components/project-form';
import { ProjectStatusBadge } from '@/components/project-status-badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDate, formatMinutes, todayIso } from '@/lib/dates';
import { PROJECT_PRIORITIES, projectsQueryOptions, useCreateProject } from '@/lib/projects';
import { ROLE_LABELS, workspaceQueryOptions } from '@/lib/workspaces';

// Es el id de la ruta (no la URL): cuelga de la ruta sin URL "app", de ahí el /app
const route = getRouteApi('/app/w/$workspaceId');

/** Un workspace: sus proyectos y, si mi rol lo permite, el formulario para crear uno (HU-05) */
export function WorkspacePage() {
  const { workspaceId } = route.useParams();
  const { data: workspace } = useSuspenseQuery(workspaceQueryOptions(workspaceId));
  const { data: projects } = useSuspenseQuery(projectsQueryOptions(workspaceId));
  const canCreate = roleHasPermission(workspace.role, 'project.create');
  const today = todayIso();

  return (
    <div className="grid gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Proyectos</h1>
        <p className="mt-1 text-muted-foreground">
          {workspace.name} · tu rol: {ROLE_LABELS[workspace.role]}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Proyectos</CardTitle>
          <CardDescription>
            {projects.length === 0 ? 'Todavía no hay proyectos' : `${projects.length} en total`}
          </CardDescription>
        </CardHeader>
        {projects.length > 0 && (
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground">
                <tr className="border-b">
                  <th className="py-2 pr-4 font-medium">Nombre</th>
                  <th className="py-2 pr-4 font-medium">Área</th>
                  <th className="py-2 pr-4 font-medium">Clasificación</th>
                  <th className="py-2 pr-4 font-medium">Estado</th>
                  <th className="py-2 pr-4 font-medium">Prioridad</th>
                  <th className="py-2 pr-4 font-medium">Avance</th>
                  <th className="py-2 pr-4 font-medium">Pendiente</th>
                  <th className="py-2 font-medium">Fin</th>
                </tr>
              </thead>
              <tbody>
                {projects.map((project) => (
                  <tr key={project.id} className="border-b last:border-0">
                    <td className="py-2 pr-4 font-medium">
                      <Link
                        to="/w/$workspaceId/p/$projectId"
                        params={{ workspaceId, projectId: project.id }}
                        className="hover:underline"
                      >
                        {project.name}
                      </Link>
                    </td>
                    <td className="py-2 pr-4">{project.area ?? '—'}</td>
                    <td className="py-2 pr-4">{project.classification ?? '—'}</td>
                    <td className="py-2 pr-4">
                      <ProjectStatusBadge status={project.status} />
                    </td>
                    <td className="py-2 pr-4">{PROJECT_PRIORITIES[project.priority]}</td>
                    <td className="py-2 pr-4">
                      <div className="flex min-w-28 items-center gap-2">
                        <ProgressBar
                          percent={project.progress.percent}
                          label={`Avance de ${project.name}`}
                        />
                        <span className="w-9 text-right tabular-nums">
                          {project.progress.percent}%
                        </span>
                      </div>
                    </td>
                    <td className="py-2 pr-4 whitespace-nowrap">
                      {formatMinutes(project.progress.pendingMinutes)}
                    </td>
                    <td className="py-2 whitespace-nowrap">
                      {formatDate(project.endDate)}
                      <span className="block text-xs text-muted-foreground">
                        {daysRemainingLabel(project.endDate, today)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        )}
      </Card>

      {canCreate && <CreateProjectCard workspaceId={workspaceId} />}
    </div>
  );
}

function CreateProjectCard({ workspaceId }: { workspaceId: string }) {
  const createProject = useCreateProject(workspaceId);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Nuevo proyecto</CardTitle>
      </CardHeader>
      <CardContent>
        <ProjectForm
          submitLabel="Crear proyecto"
          isPending={createProject.isPending}
          error={createProject.error?.message}
          onSubmit={(data, form) => createProject.mutate(data, { onSuccess: () => form.reset() })}
        />
      </CardContent>
    </Card>
  );
}
