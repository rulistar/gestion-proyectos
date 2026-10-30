import { useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

/**
 * Enlace de un solo uso (invitación, restablecer contraseña) que solo se puede ver ahora: la API
 * no lo guarda (solo su hash)
 */
export function CopyLinkBox({
  children,
  url,
  label,
}: {
  children: ReactNode;
  url: string;
  label: string;
}) {
  const [copied, setCopied] = useState(false);

  function copy() {
    void navigator.clipboard.writeText(url).then(() => setCopied(true));
  }

  return (
    <div role="status" className="grid gap-2 rounded-md border border-dashed bg-muted/50 p-4">
      <p className="text-sm">
        {children} <strong>Cópialo ahora</strong>: por seguridad no se vuelve a mostrar.
      </p>
      <div className="flex gap-2">
        <Input readOnly value={url} aria-label={label} onFocus={(e) => e.target.select()} />
        <Button type="button" variant="outline" onClick={copy}>
          {copied ? 'Copiado' : 'Copiar'}
        </Button>
      </div>
    </div>
  );
}
