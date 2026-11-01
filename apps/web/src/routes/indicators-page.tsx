import {
  indicatorYears,
  timeIndicators,
  type TimeIndicator,
  type TimedItem,
} from '@gestion/shared';
import { useSuspenseQuery } from '@tanstack/react-query';
import { getRouteApi } from '@tanstack/react-router';
import { useState } from 'react';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { NativeSelect } from '@/components/ui/native-select';
import { localDateOf, todayIso } from '@/lib/dates';
import { projectsQueryOptions } from '@/lib/projects';
import { workspaceTasksQueryOptions } from '@/lib/tasks';
import { workspaceQueryOptions } from '@/lib/workspaces';

// Es el id de la ruta (no la URL): cuelga de la ruta sin URL "app", de ahí el /app
const route = getRouteApi('/app/w/$workspaceId/indicadores');

const localDate = (instant: string) => localDateOf(instant)!;

/**
 * Indicadores de tiempos (HU-12, ADR-0004 §2.1) por tipo, del año elegido: espera, trabajo,
 * atención, % a tiempo y desviación. Solo cuenta lo terminado (tareas Hechas, contenedores
 * Terminados), y solo lo que la persona puede ver.
 */
export function IndicatorsPage() {
  const { workspaceId } = route.useParams();
  const { data: workspace } = useSuspenseQuery(workspaceQueryOptions(workspaceId));
  const { data: projects } = useSuspenseQuery(projectsQueryOptions(workspaceId));
  const { data: tasks } = useSuspenseQuery(workspaceTasksQueryOptions(workspaceId));
  const currentYear = Number(todayIso().slice(0, 4));
  const [year, setYear] = useState(currentYear);

  const taskItems: TimedItem[] = tasks
    .filter((task) => task.status === 'DONE')
    .map((task) => ({
      typeName: task.type.name,
      createdAt: task.createdAt,
      startedAt: task.startedAt,
      finishedAt: task.completedAt,
      endDate: task.endDate,
    }));
  const containerItems: TimedItem[] = projects
    .filter((project) => project.status === 'DONE')
    .map((project) => ({
      typeName: project.type.name,
      createdAt: project.createdAt,
      startedAt: project.startedAt,
      finishedAt: project.finishedAt,
      endDate: project.endDate,
    }));
  const years = indicatorYears([...taskItems, ...containerItems], currentYear, localDate);

  return (
    <div className="grid gap-3">
      <PageHeader title="Indicadores" description={`${workspace.name} · tiempos por tipo`}>
        <label className="flex items-center gap-2 text-sm">
          Año
          <NativeSelect
            value={year}
            onChange={(event) => setYear(Number(event.target.value))}
            className="h-8 w-24"
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </NativeSelect>
        </label>
      </PageHeader>
      <IndicatorTable
        title="Tareas"
        description={`Hechas en ${year}`}
        rows={timeIndicators(taskItems, year, localDate)}
      />
      <IndicatorTable
        title="Proyectos, mantenimientos y actividades"
        description={`Terminados en ${year}`}
        rows={timeIndicators(containerItems, year, localDate)}
      />
      <p className="text-xs text-muted-foreground">
        Espera = alta → inicio real · Trabajo = inicio real → fin real · Atención = alta → fin real
        · A tiempo = fin real a más tardar el fin planeado (de los que lo tienen) · Desviación = fin
        real − fin planeado, en días (positivo = tarde). Promedios en días.
      </p>
    </div>
  );
}

const days = (value: number | null) =>
  value === null ? '—' : `${value.toLocaleString('es-MX')} d`;

function IndicatorTable({
  title,
  description,
  rows,
}: {
  title: string;
  description: string;
  rows: TimeIndicator[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nada terminado en este año.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground">
                <tr className="border-b">
                  <th className="py-1.5 pr-3 font-medium">Tipo</th>
                  <th className="px-3 py-1.5 text-right font-medium">Cantidad</th>
                  <th className="px-3 py-1.5 text-right font-medium">Espera</th>
                  <th className="px-3 py-1.5 text-right font-medium">Trabajo</th>
                  <th className="px-3 py-1.5 text-right font-medium">Atención</th>
                  <th className="px-3 py-1.5 text-right font-medium">A tiempo</th>
                  <th className="py-1.5 pl-3 text-right font-medium">Desviación</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {rows.map((row) => (
                  <tr key={row.typeName} className="border-b last:border-0">
                    <td className="py-1.5 pr-3">{row.typeName}</td>
                    <td className="px-3 py-1.5 text-right">{row.count}</td>
                    <td className="px-3 py-1.5 text-right">{days(row.waitDays)}</td>
                    <td className="px-3 py-1.5 text-right">{days(row.workDays)}</td>
                    <td className="px-3 py-1.5 text-right">{days(row.leadDays)}</td>
                    <td className="px-3 py-1.5 text-right">
                      {row.onTimePercent === null ? '—' : `${row.onTimePercent} %`}
                    </td>
                    <td className="py-1.5 pl-3 text-right">
                      {row.deviationDays === null
                        ? '—'
                        : `${row.deviationDays > 0 ? '+' : ''}${days(row.deviationDays)}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
