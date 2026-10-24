import { createWorkspaceRequestSchema } from '@gestion/shared';
import { useSuspenseQuery } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCurrentUser } from '@/lib/auth';
import { ROLE_LABELS, useCreateWorkspace, workspacesQueryOptions } from '@/lib/workspaces';

/** Inicio: mis workspaces y crear uno nuevo (HU-03). Los proyectos llegan en el Sprint 2 */
export function HomePage() {
  const user = useCurrentUser();
  // La ruta ya los cargó (loader), así que aquí están disponibles al instante
  const { data: workspaces } = useSuspenseQuery(workspacesQueryOptions);

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Hola, {user.name}</CardTitle>
          <CardDescription>Tus espacios de trabajo</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="divide-y rounded-md border bg-background">
            {workspaces.map((workspace) => (
              <li key={workspace.id} className="flex items-center justify-between px-4 py-3">
                <span className="font-medium">{workspace.name}</span>
                <span className="text-sm text-muted-foreground">{ROLE_LABELS[workspace.role]}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
      <CreateWorkspaceCard />
    </div>
  );
}

function CreateWorkspaceCard() {
  const createWorkspace = useCreateWorkspace();
  const [error, setError] = useState<string>();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    // Mismo esquema que valida la API
    const parsed = createWorkspaceRequestSchema.safeParse({
      name: new FormData(form).get('name'),
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message);
      return;
    }

    setError(undefined);
    createWorkspace.mutate(parsed.data, { onSuccess: () => form.reset() });
  }

  const message = error ?? createWorkspace.error?.message;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Nuevo espacio de trabajo</CardTitle>
        <CardDescription>Quedarás como Admin del espacio que crees</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} noValidate className="grid gap-2">
          <Label htmlFor="workspace-name">Nombre</Label>
          <div className="flex gap-2">
            <Input
              id="workspace-name"
              name="name"
              maxLength={80}
              placeholder="Por ejemplo: Equipo de cursos"
              aria-invalid={Boolean(message)}
              aria-describedby={message ? 'workspace-name-error' : undefined}
            />
            <Button type="submit" disabled={createWorkspace.isPending}>
              {createWorkspace.isPending ? 'Creando…' : 'Crear'}
            </Button>
          </div>
          {message && (
            <p id="workspace-name-error" role="alert" className="text-sm text-destructive">
              {message}
            </p>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
