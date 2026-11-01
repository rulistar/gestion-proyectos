import { projectsByEndMonth, projectsByStatus, type Project } from '@gestion/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { localDateOf } from '@/lib/dates';
import { PROJECT_STATUSES } from '@/lib/projects';

const MONTHS = ['E', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
const MONTH_NAMES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

/** Colores del prototipo: a tiempo = Terminado, tarde = Cancelado (rojo), abierto = No iniciado */
const SEGMENTS = [
  { key: 'onTime', label: 'Terminado a tiempo', color: PROJECT_STATUSES.DONE.color },
  { key: 'late', label: 'Terminado tarde', color: PROJECT_STATUSES.CANCELLED.color },
  { key: 'open', label: 'Abierto', color: PROJECT_STATUSES.NOT_STARTED.color },
] as const;

const localDate = (instant: string) => localDateOf(instant)!;

/**
 * Gráficas del acta (HU-12) arriba de cada lista: por mes de término (fin planeado, dividido en a
 * tiempo, tarde y abiertos) y por estado. Reciben la lista ya filtrada: grafican lo que se ve.
 * Barras con CSS, sin librería (como el Gantt).
 */
export function ProjectCharts({ projects, year }: { projects: Project[]; year: number }) {
  const byMonth = projectsByEndMonth(projects, year, localDate);
  const byStatus = projectsByStatus(projects);
  const monthMax = Math.max(1, ...byMonth.months.map((m) => m.onTime + m.late + m.open));
  const statusMax = Math.max(1, ...byStatus.map((s) => s.count));
  const extras = [
    byMonth.noDate > 0 && `Sin fecha fin: ${byMonth.noDate}`,
    byMonth.otherYears > 0 && `Con fin en otro año: ${byMonth.otherYears}`,
  ].filter(Boolean);

  return (
    <div className="grid gap-3 lg:grid-cols-[3fr_2fr]">
      <Card className="gap-2 py-3">
        <CardHeader className="px-4">
          <CardTitle className="text-sm">Por mes de término (fin planeado) · {year}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 px-4">
          <div className="flex h-32 items-end gap-1.5" role="list" aria-label="Por mes de término">
            {byMonth.months.map((bucket) => {
              const total = bucket.onTime + bucket.late + bucket.open;
              const detail = SEGMENTS.map((s) => `${s.label}: ${bucket[s.key]}`).join(' · ');
              return (
                <div
                  key={bucket.month}
                  role="listitem"
                  aria-label={`${MONTH_NAMES[bucket.month - 1]}: ${total} (${detail})`}
                  title={`${MONTH_NAMES[bucket.month - 1]}: ${total}\n${detail}`}
                  className="flex h-full flex-1 flex-col items-center justify-end gap-0.5"
                >
                  {total > 0 && <span className="text-[11px] tabular-nums">{total}</span>}
                  <div
                    className="flex w-full max-w-10 flex-col-reverse overflow-hidden rounded-t"
                    style={{ height: `${(total / monthMax) * 100}%` }}
                  >
                    {SEGMENTS.map((s) =>
                      bucket[s.key] > 0 ? (
                        <div
                          key={s.key}
                          style={{
                            backgroundColor: s.color,
                            height: `${(bucket[s.key] / total) * 100}%`,
                          }}
                        />
                      ) : null,
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex gap-1.5 border-t pt-1">
            {MONTHS.map((label, i) => (
              <span key={i} className="flex-1 text-center text-[11px] text-muted-foreground">
                {label}
              </span>
            ))}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {SEGMENTS.map((s) => (
              <span key={s.key} className="inline-flex items-center gap-1.5">
                <span
                  aria-hidden
                  className="size-2.5 rounded-sm"
                  style={{ backgroundColor: s.color }}
                />
                {s.label}
              </span>
            ))}
            {extras.length > 0 && <span>· {extras.join(' · ')}</span>}
            <span>· Los cancelados solo cuentan por estado</span>
          </div>
        </CardContent>
      </Card>

      <Card className="gap-2 py-3">
        <CardHeader className="px-4">
          <CardTitle className="text-sm">Por estado</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-1.5 px-4">
          {byStatus.map(({ status, count }) => (
            <div key={status} className="grid grid-cols-[6.5rem_1fr_2rem] items-center gap-2">
              <span className="text-sm">{PROJECT_STATUSES[status].label}</span>
              <div className="h-4 rounded bg-muted">
                <div
                  className="h-full rounded"
                  style={{
                    width: `${(count / statusMax) * 100}%`,
                    backgroundColor: PROJECT_STATUSES[status].color,
                  }}
                />
              </div>
              <span className="text-right text-sm tabular-nums">{count}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
