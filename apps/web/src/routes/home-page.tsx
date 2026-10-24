import type { MembershipRole } from '@gestion/shared';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useCurrentUser } from '@/lib/auth';

const ROLE_LABELS: Record<MembershipRole, string> = {
  ADMIN: 'Admin',
  MEMBER: 'Miembro',
  VIEWER: 'Lector',
};

/** Inicio provisional: los proyectos llegan en el Sprint 2 */
export function HomePage() {
  const user = useCurrentUser();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Hola, {user.name}</CardTitle>
        <CardDescription>Tus espacios de trabajo</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="divide-y rounded-md border bg-background">
          {user.workspaces.map((workspace) => (
            <li key={workspace.id} className="flex items-center justify-between px-4 py-3">
              <span className="font-medium">{workspace.name}</span>
              <span className="text-sm text-muted-foreground">{ROLE_LABELS[workspace.role]}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
