import {
  personListSchema,
  personSchema,
  type CreatePersonInput,
  type Person,
  type UpdatePersonInput,
} from '@gestion/shared';
import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './api';

/** Responsabilidades de la tarea (HU-35), en el orden en que se muestran */
export const TASK_ROLES = [
  { role: 'ACTIVITY', label: 'Actividad', field: 'activityPersonId', key: 'activity' },
  { role: 'MANAGEMENT', label: 'Gestión', field: 'managementPersonId', key: 'management' },
  { role: 'FOLLOW_UP', label: 'Seguimiento', field: 'followUpPersonId', key: 'followUp' },
] as const;

/** Personas que se pueden elegir: las activas y, al editar, la que ya tenía aunque esté archivada */
export function selectablePeople(people: Person[], currentId: string | null | undefined) {
  return people.filter((person) => !person.archived || person.id === currentId);
}

const peoplePath = (workspaceId: string) => `/workspaces/${workspaceId}/people`;

export const peopleQueryOptions = (workspaceId: string) =>
  queryOptions({
    queryKey: ['workspaces', workspaceId, 'people'],
    queryFn: () => apiFetch(peoplePath(workspaceId), { schema: personListSchema }),
  });

/** El nombre de una persona aparece en miembros, tareas y proyectos: se refresca el espacio */
export function useCreatePerson(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreatePersonInput) =>
      apiFetch(peoplePath(workspaceId), { method: 'POST', body: data, schema: personSchema }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['workspaces', workspaceId] }),
  });
}

export function useUpdatePerson(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ personId, ...data }: UpdatePersonInput & { personId: string }) =>
      apiFetch(`${peoplePath(workspaceId)}/${personId}`, {
        method: 'PATCH',
        body: data,
        schema: personListSchema,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['workspaces', workspaceId] }),
  });
}
