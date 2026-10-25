import { myTaskListSchema } from '@gestion/shared';
import { queryOptions } from '@tanstack/react-query';
import { apiFetch } from './api';

/** Mis tareas del workspace (HU-28b): abiertas y hechas desde el inicio de mi semana */
export const myTasksQueryOptions = (workspaceId: string, weekStart: string) =>
  queryOptions({
    queryKey: ['workspaces', workspaceId, 'my-tasks', weekStart],
    queryFn: () =>
      apiFetch(`/workspaces/${workspaceId}/my-tasks?doneSince=${encodeURIComponent(weekStart)}`, {
        schema: myTaskListSchema,
      }),
  });
