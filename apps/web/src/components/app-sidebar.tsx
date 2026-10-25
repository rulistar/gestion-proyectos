import { roleHasPermission } from '@gestion/shared';
import { Link, useNavigate, useParams } from '@tanstack/react-router';
import {
  ChartGantt,
  FolderKanban,
  Inbox,
  ListChecks,
  Pencil,
  Plus,
  Settings,
  Trash2,
  Users,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { AppLogo } from '@/components/app-logo';
import { CreateWorkspaceDialog } from '@/components/create-workspace-dialog';
import { RenameWorkspaceDialog } from '@/components/rename-workspace-dialog';
import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/native-select';
import { useCurrentUser } from '@/lib/auth';
import { cn } from '@/lib/utils';

const itemClass =
  'flex min-h-10 items-center gap-2.5 rounded-lg px-3 text-sm font-medium text-[#344054] transition-colors hover:bg-muted hover:text-foreground [&_svg]:size-[18px] [&_svg]:shrink-0';

/** Opción que llega en una historia posterior: se ve, pero aún no se puede usar */
function SoonItem({
  icon: Icon,
  label,
  story,
}: {
  icon: LucideIcon;
  label: string;
  story: string;
}) {
  return (
    <span
      aria-disabled="true"
      title={`Llega con ${story}`}
      className={cn(itemClass, 'cursor-default opacity-60 hover:bg-transparent')}
    >
      <Icon aria-hidden />
      {label}
      <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
        Pronto
      </span>
    </span>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <span className="px-3 pb-1.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
      {children}
    </span>
  );
}

/**
 * Menú lateral (HU-28): combo del espacio de trabajo y secciones, en el orden que pidió el PO.
 * El Admin del sistema ve en el combo todos los espacios; los demás, solo aquellos en que participan.
 */
export function AppSidebar() {
  const user = useCurrentUser();
  const navigate = useNavigate();
  // Las rutas /w/$workspaceId/... traen el espacio actual; en las demás no hay uno elegido
  const { workspaceId } = useParams({ strict: false });
  const current = user.workspaces.find((w) => w.id === workspaceId);

  return (
    <nav
      aria-label="Menú principal"
      className="flex w-full flex-col gap-5 border-b bg-card px-3.5 py-5 md:sticky md:top-0 md:h-screen md:w-64 md:shrink-0 md:overflow-y-auto md:border-r md:border-b-0"
    >
      <Link to="/" className="px-1.5">
        <AppLogo />
      </Link>

      <div className="grid gap-1.5 px-0.5">
        <label
          htmlFor="workspace-switcher"
          className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase"
        >
          Espacio de trabajo
        </label>
        <NativeSelect
          id="workspace-switcher"
          value={current?.id ?? ''}
          onChange={(event) =>
            void navigate({ to: '/w/$workspaceId', params: { workspaceId: event.target.value } })
          }
          className="h-11 bg-muted/60 font-semibold"
        >
          {!current && (
            <option value="" disabled>
              Elige un espacio…
            </option>
          )}
          {user.workspaces.map((workspace) => (
            <option key={workspace.id} value={workspace.id}>
              {workspace.name}
            </option>
          ))}
        </NativeSelect>
        <div className="flex flex-wrap gap-1">
          <CreateWorkspaceDialog
            trigger={
              <Button variant="ghost" size="sm" className="text-primary">
                <Plus aria-hidden />
                Nuevo espacio
              </Button>
            }
          />
          {current && roleHasPermission(current.role, 'workspace.update') && (
            <RenameWorkspaceDialog
              workspace={current}
              trigger={
                <Button variant="ghost" size="sm" className="text-primary">
                  <Pencil aria-hidden />
                  Renombrar
                </Button>
              }
            />
          )}
        </div>
      </div>

      <div className="grid gap-0.5">
        {current ? (
          <Link
            to="/w/$workspaceId"
            params={{ workspaceId: current.id }}
            activeOptions={{ exact: true }}
            className={itemClass}
            activeProps={{ className: 'bg-accent text-accent-foreground', 'aria-current': 'page' }}
          >
            <FolderKanban aria-hidden />
            Proyectos
          </Link>
        ) : (
          <SoonItem icon={FolderKanban} label="Proyectos" story="un espacio elegido" />
        )}
        <SoonItem icon={Wrench} label="Mantenimientos" story="HU-21" />
        <SoonItem icon={ListChecks} label="Mi trabajo" story="HU-28b" />
        <SoonItem icon={Inbox} label="Actividades" story="HU-21" />
        <SoonItem icon={ChartGantt} label="Gantt" story="HU-27" />
      </div>

      {/* Administración: solo para quien administra el espacio (los demás no ven la sección) */}
      {current && roleHasPermission(current.role, 'member.manage') && (
        <div className="grid gap-0.5">
          <SectionTitle>Administración</SectionTitle>
          <Link
            to="/w/$workspaceId/miembros"
            params={{ workspaceId: current.id }}
            className={itemClass}
            activeProps={{ className: 'bg-accent text-accent-foreground', 'aria-current': 'page' }}
          >
            <Users aria-hidden />
            Miembros
          </Link>
          <SoonItem icon={Trash2} label="Papelera" story="HU-15" />
          <SoonItem icon={Settings} label="Configuración" story="HU-21" />
        </div>
      )}
    </nav>
  );
}
