import { roleHasPermission, type ImportPreview, type ImportRequest } from '@gestion/shared';
import { useSuspenseQuery } from '@tanstack/react-query';
import { getRouteApi, Link } from '@tanstack/react-router';
import { FileUp } from 'lucide-react';
import { useState, type ChangeEvent, type ReactNode } from 'react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useApplyImport, usePreviewImport } from '@/lib/imports';
import { workspaceQueryOptions } from '@/lib/workspaces';

// Es el id de la ruta (no la URL): cuelga de la ruta sin URL "app", de ahí el /app
const route = getRouteApi('/app/w/$workspaceId/cargar');

/**
 * Cargar información (HU-14), solo el Admin: un JSON o un CSV de Exportar, o un respaldo del
 * prototipo. Primero se ve el resumen (nada se guarda) y luego se confirma. Solo Actualizar: lo
 * que coincide se actualiza, lo demás se crea; nunca se borra nada.
 */
export function ImportPage() {
  const { workspaceId } = route.useParams();
  const { data: workspace } = useSuspenseQuery(workspaceQueryOptions(workspaceId));
  const preview = usePreviewImport(workspaceId);
  const apply = useApplyImport(workspaceId);
  const [file, setFile] = useState<ImportRequest>();
  const [done, setDone] = useState<ImportPreview>();

  if (!roleHasPermission(workspace.role, 'catalog.manage')) {
    return (
      <Card className="mx-auto mt-8 max-w-md">
        <CardHeader>
          <CardTitle>Solo para el Admin</CardTitle>
          <CardDescription>Cargar información la hace el Admin de este espacio.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  async function choose(event: ChangeEvent<HTMLInputElement>) {
    const chosen = event.target.files?.[0];
    event.target.value = '';
    if (!chosen) return;
    if (chosen.size > 5_000_000) {
      toast.error('El archivo pesa más de 5 MB');
      return;
    }
    const request = { fileName: chosen.name, content: await chosen.text() };
    setFile(request);
    setDone(undefined);
    apply.reset();
    preview.mutate(request);
  }

  function confirm() {
    if (!file) return;
    apply.mutate(file, {
      onSuccess: (result) => {
        setDone(result);
        setFile(undefined);
        preview.reset();
        toast.success('Información cargada');
      },
    });
  }

  return (
    <div className="grid gap-3">
      <PageHeader
        title="Cargar información"
        description={`${workspace.name} · desde un respaldo JSON o un Excel (CSV) de Exportar, o un respaldo del prototipo`}
      />
      <Card>
        <CardContent className="grid gap-3">
          <p className="text-sm text-muted-foreground">
            Lo que coincide (por folio o, si no tiene, por nombre) se <strong>actualiza</strong> y
            lo demás se <strong>crea</strong>. Nunca se borra nada, y una celda vacía no borra lo
            que ya hay. Antes de guardar verás un resumen.
          </p>
          <label className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-md border border-dashed px-4 py-3 text-sm font-medium hover:bg-muted">
            <FileUp aria-hidden className="size-5 text-primary" />
            {file ? `Elegir otro archivo (ahora: ${file.fileName})` : 'Elegir archivo .json o .csv'}
            <input
              type="file"
              accept=".json,.csv,application/json,text/csv"
              className="sr-only"
              onChange={(event) => void choose(event)}
            />
          </label>
          {preview.isPending && (
            <p className="text-sm text-muted-foreground">Leyendo el archivo…</p>
          )}
          {preview.error && (
            <p role="alert" className="text-sm text-destructive">
              {preview.error.message}
            </p>
          )}
        </CardContent>
      </Card>

      {preview.data && file && (
        <Summary
          title={`Resumen de ${file.fileName}`}
          preview={preview.data}
          action={
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={confirm} disabled={apply.isPending}>
                {apply.isPending ? 'Cargando…' : 'Cargar información'}
              </Button>
              <Button
                variant="ghost"
                disabled={apply.isPending}
                onClick={() => {
                  setFile(undefined);
                  preview.reset();
                }}
              >
                Cancelar
              </Button>
              {apply.error && (
                <p role="alert" className="text-sm text-destructive">
                  {apply.error.message}
                </p>
              )}
            </div>
          }
        />
      )}

      {done && (
        <Summary
          title="Carga terminada"
          preview={done}
          action={
            <Link to="/w/$workspaceId" params={{ workspaceId }} className="text-sm font-medium">
              Ir a Proyectos
            </Link>
          }
        />
      )}
    </div>
  );
}

function Summary({
  title,
  preview,
  action,
}: {
  title: string;
  preview: ImportPreview;
  action: ReactNode;
}) {
  const { newCatalog } = preview;
  const catalog = [
    ['Tipos de contenedor', newCatalog.projectTypes],
    ['Tipos de tarea', newCatalog.taskTypes],
    ['Orígenes', newCatalog.origins],
    ['Personas (sin cuenta)', newCatalog.people],
  ] as const;
  const anyCatalog = catalog.some(([, names]) => names.length > 0) || newCatalog.phases > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>Formato: {preview.source}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Count
            label="Contenedores"
            created={preview.containers.created}
            updated={preview.containers.updated}
          />
          <Count label="Tareas" created={preview.tasks.created} updated={preview.tasks.updated} />
        </div>
        {anyCatalog && (
          <div className="grid gap-1 rounded-md border bg-muted/40 p-3 text-sm">
            <p className="font-semibold">Se crearán en los catálogos</p>
            {catalog.map(
              ([label, names]) =>
                names.length > 0 && (
                  <p key={label}>
                    <span className="text-muted-foreground">{label}:</span> {names.join(', ')}
                  </p>
                ),
            )}
            {newCatalog.phases > 0 && (
              <p>
                <span className="text-muted-foreground">Fases:</span> {newCatalog.phases}
              </p>
            )}
          </div>
        )}
        <div className="max-h-72 overflow-y-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-card text-left text-muted-foreground">
              <tr className="border-b">
                <th className="px-3 py-1.5 font-medium">Proyecto / mantenimiento / actividad</th>
                <th className="px-3 py-1.5 font-medium">Qué pasa</th>
                <th className="px-3 py-1.5 font-medium">Tareas nuevas</th>
                <th className="px-3 py-1.5 font-medium">Tareas actualizadas</th>
              </tr>
            </thead>
            <tbody>
              {preview.items.map((item, index) => (
                <tr key={`${item.name}-${index}`} className="border-b last:border-0">
                  <td className="px-3 py-1.5">{item.name}</td>
                  <td className="px-3 py-1.5">
                    {item.action === 'create' ? 'Se crea' : 'Se actualiza'}
                  </td>
                  <td className="px-3 py-1.5 tabular-nums">{item.newTasks}</td>
                  <td className="px-3 py-1.5 tabular-nums">{item.updatedTasks}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {preview.warnings.length > 0 && (
          <details className="text-sm">
            <summary className="cursor-pointer font-medium text-warning-foreground">
              Avisos ({preview.warnings.length})
            </summary>
            <ul className="mt-2 list-disc pl-5 text-muted-foreground">
              {preview.warnings.map((warning, index) => (
                <li key={index}>{warning}</li>
              ))}
            </ul>
          </details>
        )}
        {action}
      </CardContent>
    </Card>
  );
}

function Count({ label, created, updated }: { label: string; created: number; updated: number }) {
  return (
    <div className="rounded-md border p-3">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold">
        {created} nuevos · {updated} actualizados
      </p>
    </div>
  );
}
