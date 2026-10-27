import {
  personListSchema,
  personSchema,
  type CreatePersonInput,
  type Person,
  type UpdatePersonInput,
} from '@gestion/shared';
import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './api';

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
