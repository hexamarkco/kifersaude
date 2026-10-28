import { useState, type ReactNode } from 'react';
import { Calendar, Info } from 'lucide-react';
import { ActionSurface, Avatar, Badge, Checkbox, RecordActions, Surface, Text, TextLink, type RecordAction } from '../../../design-system';
import { LeadFavoriteToggle } from '../../../components/LeadFavoriteStar';
import { formatDateTimeFullBR } from '../../../lib/dateUtils';
import type { Lead } from '../domain/types';

type LeadListCardProps = {
  lead: Lead;
  status: ReactNode;
  selected: boolean;
  canSelect: boolean;
  hasContract: boolean;
  actions: readonly RecordAction[];
  whatsappHref?: string;
  onOpen: () => void;
  onSelect: () => void;
  onFavoriteChange: (next: boolean) => void;
};

export function LeadListCard({ lead, status, selected, canSelect, hasContract, actions, whatsappHref, onOpen, onSelect, onFavoriteChange }: LeadListCardProps) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  return (
    <Surface padding="sm" className="kds-lead-list-card" role="article" aria-label={lead.nome_completo}>
      <div className="kds-lead-list-card-heading">
        <ActionSurface variant="plain" padding="none" onClick={onOpen} className="kds-lead-identity" aria-label={`Abrir lead ${lead.nome_completo}`}>
          <Avatar name={lead.nome_completo} tone="brand" size="sm" className="kds-lead-avatar" />
          <span className="min-w-0">
            <span className="kds-lead-list-card-title">{lead.nome_completo}</span>
            <span className="kds-lead-list-card-contact">{lead.email || lead.telefone || 'Sem contato cadastrado'}</span>
          </span>
        </ActionSurface>
        <div className="kds-lead-list-card-controls">
          {canSelect && <Checkbox checked={selected} onChange={onSelect} aria-label={`Selecionar lead ${lead.nome_completo}`} />}
          <LeadFavoriteToggle leadId={lead.id} favorito={Boolean(lead.favorito)} size="sm" onToggled={onFavoriteChange} />
        </div>
      </div>
      <div className="kds-lead-list-card-status">
        {status}
        <Text size="sm" className="kds-lead-list-card-source">{lead.origem || 'Sem origem'} · {lead.tipo_contratacao || 'Sem tipo'}</Text>
        {hasContract && <Badge tone="info" size="sm">Contrato</Badge>}
      </div>
      {detailsOpen && <dl className="kds-lead-list-card-data" aria-label="Dados do contato">
          <div><dt>Telefone</dt><dd>{whatsappHref ? <TextLink href={whatsappHref} target="_blank" rel="noreferrer" aria-label={`Abrir WhatsApp para ${lead.nome_completo}`}>{lead.telefone}</TextLink> : lead.telefone || 'Não informado'}</dd></div>
          <div><dt>E-mail</dt><dd>{lead.email || 'Não informado'}</dd></div>
          <div><dt>Responsável</dt><dd>{lead.responsavel || 'Não atribuído'}</dd></div>
          <div><dt>Criado em</dt><dd>{new Date(lead.data_criacao).toLocaleDateString('pt-BR')}</dd></div>
          {lead.cidade && <div><dt>Cidade</dt><dd>{lead.cidade}</dd></div>}
      </dl>}
      <div className="kds-lead-list-card-footer">
        <div className="kds-lead-list-card-followup">
          <span>Próximo follow-up</span>
          <Text size="sm">{lead.proximo_retorno ? <><Calendar className="kds-control-icon" aria-hidden="true" />{formatDateTimeFullBR(lead.proximo_retorno)}</> : 'Sem follow-up'}</Text>
        </div>
        <RecordActions label="Ações do lead" actions={[...actions, { label: detailsOpen ? 'Ocultar dados do contato' : 'Dados do contato', icon: Info, onClick: () => setDetailsOpen(open => !open) }]} />
      </div>

    </Surface>
  );
}
