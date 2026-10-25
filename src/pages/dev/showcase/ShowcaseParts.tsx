import { Heading, Text, TextLink } from '../../../design-system';
import { useState, type ReactNode } from 'react';
import { ArrowRight, Check, Copy, ExternalLink } from 'lucide-react';
import { Button, IconButton, useToast } from '../../../design-system';

export function Specimen({
  title,
  description,
  source,
  children,
  wide = false,
}: {
  title: string;
  description: string;
  source: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <article className={`ds-specimen${wide ? ' ds-specimen-wide' : ''}`}>
      <div className="ds-specimen-heading">
        <Heading level={3}>{title}</Heading>
        <span className="ds-live-dot" title="Componente real do projeto" />
      </div>
      <Text className="ds-description">{description}</Text>
      <div className="ds-specimen-body">{children}</div>
      <details className="ds-source">
        <summary>Implementação no projeto</summary>
        <code>{source}</code>
      </details>
    </article>
  );
}

export function SectionIntro({
  number,
  title,
  children,
}: {
  number: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="ds-section-intro">
      <span className="ds-eyebrow">{number} / KIFER SAÚDE</span>
      <Heading level={1}>{title}</Heading>
      <Text>{children}</Text>
    </div>
  );
}

export function UsageNote({
  title = 'Padrão de uso',
  children,
}: {
  title?: string;
  children: ReactNode;
}) {
  return (
    <aside className="ds-usage">
      <span className="ds-eyebrow">{title}</span>
      <div>{children}</div>
    </aside>
  );
}

export function CopyValue({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  return (
    <IconButton
      variant="ghost"
      size="sm"
      aria-label={`Copiar ${label ?? value}`}
      onClick={async () => {
        try {
          if (!navigator.clipboard) throw new Error('Clipboard unavailable');
          await navigator.clipboard.writeText(value);
          setCopied(true);
        } catch {
          toast({
            variant: 'error',
            description:
              'Não foi possível copiar. Selecione o valor e copie manualmente.',
          });
        }
      }}
    >
      {copied ? <Check /> : <Copy />}
    </IconButton>
  );
}

export function ExploreButton({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <Button variant="text" size="sm" onClick={onClick}>
      {children}
      <ArrowRight />
    </Button>
  );
}

export function PreviewLink({
  pattern,
  theme,
}: {
  pattern: string;
  theme: string;
}) {
  return (
    <TextLink
      className="ds-text-link"
      href={`/design-system?preview=1&pattern=${pattern}&theme=${theme}`}
      target="_blank"
      rel="noreferrer"
    >
      Abrir exemplo
      <ExternalLink size={14} aria-hidden="true" />
    </TextLink>
  );
}
