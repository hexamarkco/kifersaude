import { useState } from 'react';
import { ArrowUpRight, FileText, Search, Users, type LucideIcon } from 'lucide-react';
import { Button, Dialog, DialogBody, DialogFooter, DialogHeader, DialogTitle, DropdownOption, Input, Text } from '../design-system';

export type WorkspaceDestination = {
  id: string;
  label: string;
  icon: LucideIcon;
  group: string;
  onSelect: () => void;
};

type WorkspaceSearchProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  destinations: WorkspaceDestination[];
  onSearchLeads?: (query: string) => void;
  onSearchContracts?: (query: string) => void;
};

function normalize(value: string) {
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('pt-BR');
}

export function WorkspaceSearch({ open, onOpenChange, destinations, onSearchLeads, onSearchContracts }: WorkspaceSearchProps) {
  const [query, setQuery] = useState('');
  const term = query.trim();
  const normalized = normalize(term);
  const pages = destinations.filter(({ label, group }) => normalize(`${label} ${group}`).includes(normalized));
  const searchTargets = [
    { id: 'search-leads', label: 'Buscar em leads', icon: Users, search: onSearchLeads },
    { id: 'search-contracts', label: 'Buscar em contratos', icon: FileText, search: onSearchContracts },
  ].filter(({ search }) => Boolean(search));

  const select = (action: () => void) => {
    onOpenChange(false);
    action();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} initialFocus="first-content" className="kds-workspace-search-dialog">
      <DialogHeader showCloseButton={false} className="sr-only"><DialogTitle>Buscar no painel</DialogTitle></DialogHeader>
      <DialogBody>
        <div className="kds-workspace-command-input"><Input aria-label="Páginas e registros" leftIcon={Search} placeholder="O que você procura?" value={query} onChange={(event) => setQuery(event.target.value)} /></div>
        {pages.length > 0 && (
          <div className="kds-workspace-search-results" aria-label="Páginas">
            {pages.map(({ id, label, icon: Icon, group, onSelect }) => (
              <DropdownOption key={id} role="button" onClick={() => select(onSelect)} className="kds-workspace-search-result">
                <span className="kds-workspace-search-icon"><Icon className="kds-control-icon" aria-hidden="true" /></span>
                <span><strong>{label}</strong><small>{group}</small></span>
                <ArrowUpRight className="kds-control-icon" aria-hidden="true" />
              </DropdownOption>
            ))}
          </div>
        )}
        {term && searchTargets.length > 0 && (
          <div className="kds-workspace-search-results" aria-label="Registros">
            {searchTargets.map(({ id, label, icon: Icon, search }) => (
              <DropdownOption key={id} role="button" onClick={() => select(() => search?.(term))} className="kds-workspace-search-result">
                <span className="kds-workspace-search-icon"><Icon className="kds-control-icon" aria-hidden="true" /></span>
                <span><strong>{label}</strong><small>{term}</small></span>
                <ArrowUpRight className="kds-control-icon" aria-hidden="true" />
              </DropdownOption>
            ))}
          </div>
        )}
        {pages.length === 0 && <Text size="sm" tone="muted" className="kds-workspace-search-empty">Nenhuma página encontrada para essa busca.</Text>}
      </DialogBody>
      <DialogFooter><Button size="sm" variant="ghost" onClick={() => onOpenChange(false)}><kbd>Esc</kbd> Fechar busca</Button></DialogFooter>
    </Dialog>
  );
}
