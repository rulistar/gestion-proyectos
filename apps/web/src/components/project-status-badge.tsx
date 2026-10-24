import type { ProjectStatus } from '@gestion/shared';
import { PROJECT_STATUSES } from '@/lib/projects';

/** Estado del proyecto con su color del prototipo */
export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  const { label, color } = PROJECT_STATUSES[status];
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap">
      <span aria-hidden className="size-2 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}
