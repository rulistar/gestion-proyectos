import { ALL_PEOPLE, myTaskListSchema } from '@gestion/shared';
import { queryOptions } from '@tanstack/react-query';
import { apiFetch } from './api';

/**
 * Mis tareas del workspace (HU-28b): abiertas y hechas desde el inicio de mi semana. `person` (HU-52): una persona que puedo ver o `all` (yo y a quienes sigo;
 * el Admin, todos)
 */
export const myTasksQueryOptions = (workspaceId: string, weekStart: string, person = ALL_PEOPLE) =>
  queryOptions({
    queryKey: ['workspaces', workspaceId, 'my-tasks', weekStart, person],
    queryFn: () =>
      apiFetch(
        `/workspaces/${workspaceId}/my-tasks?doneSince=${encodeURIComponent(weekStart)}&person=${person}`,
        { schema: myTaskListSchema },
      ),
  });
