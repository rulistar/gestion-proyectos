import { useSuspenseQuery } from '@tanstack/react-query';
import { getRouteApi } from '@tanstack/react-router';
import { FileJson, FileSpreadsheet } from 'lucide-react';
import type { ReactNode } from 'react';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { todayIso } from '@/lib/dates';
import { useViewAs } from '@/lib/view-as';
import { workspaceQueryOptions } from '@/lib/workspaces';

// Es el id de la ruta (no la URL): cuelga de la ruta sin URL "app", de ahí el /app
const route = getRouteApi('/app/w/$workspaceId/exportar');

/**
 * Exportar (HU-13): descarga lo que el usuario puede ver del espacio (su matriz, ADR-0006), sin lo
 * de la papelera. Son enlaces normales: la API responde con el archivo y la cookie de sesión viaja
 * sola. `today` es la fecha local, para el nombre del archivo.
 */
export function ExportPage() {
  const { workspaceId } = route.useParams();
  const { data: workspace } = useSuspenseQuery(workspaceQueryOptions(workspaceId));
  // Viendo como otra persona (HU-56): descarga lo que ella ve. Un enlace no lleva encabezados
  const viewAs = useViewAs();
  const asOther = viewAs?.workspaceId === workspaceId ? `&viewAs=${viewAs.userId}` : '';
  const href = (extension: 'csv' | 'json') =>
    `/api/v1/workspaces/${workspaceId}/export.${extension}?today=${todayIso()}${asOther}`;

  return (
    <div className="grid gap-3">
      <PageHeader
        title="Exportar"
        description={`${workspace.name} · proyectos, mantenimientos y actividades que puedes ver, sin lo de la papelera`}
      />
      <div className="grid gap-3 md:grid-cols-2">
        <ExportCard
          href={href('csv')}
          icon={<FileSpreadsheet aria-hidden className="size-8 text-primary" />}
          title="Excel (CSV)"
          description="Una fila por tarea, con su proyecto, fase, fechas, estado, responsable, origen y los campos de detalle. Se abre directo en Excel con los acentos bien."
        />
        <ExportCard
          href={href('json')}
          icon={<FileJson aria-hidden className="size-8 text-primary" />}
          title="Respaldo completo (JSON)"
          description="Todo lo que ves del espacio: catálogos (tipos, orígenes, campos de detalle), personas, contenedores con sus fases y tareas. Sirve para guardar un respaldo y, más adelante, para importarlo."
        />
      </div>
    </div>
  );
}

function ExportCard({
  href,
  icon,
  title,
  description,
}: {
  href: string;
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <a href={href} download className="rounded-xl transition-shadow hover:shadow-md">
      <Card className="h-full">
        <CardHeader className="flex-row items-start gap-3">
          {icon}
          <div className="grid gap-1">
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <span className="text-sm font-medium text-primary">Descargar</span>
        </CardContent>
      </Card>
    </a>
  );
}
