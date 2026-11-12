import { useId, useRef, useState } from 'react';
import { Link2, Plus, Star, Unlink, X } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { Alert, Badge, Button, ConfirmDialog, Field, Select, Heading, IconButton, Input, LoadingState, SearchInput, Surface, Text } from '../../../design-system';
import { isOpportunityStatus, opportunityStatusLabels, type LeadOpportunity, type RelatedLead } from '../domain/leadOpportunities';
import { useLeadOpportunities, useRelatedLeadSearch } from '../hooks/useLeadOpportunities';

type LeadIdentity = { id: string; nome_completo: string };
type Editor = { opportunity: LeadOpportunity | null; requestId: string };

export function LeadRelationshipsPanel({ lead }: { lead: LeadIdentity }) {
  const { role } = useAuth();
  return role === 'admin' ? <RelationshipsPanel key={lead.id} lead={lead} /> : null;
}

function RelationshipsPanel({ lead }: { lead: LeadIdentity }) {
  const { snapshot, loading, error, saving, reload, mutate } = useLeadOpportunities(lead.id);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [removal, setRemoval] = useState<{ opportunity: LeadOpportunity; memberId: string; memberName: string } | null>(null);
  const disabled = loading || saving || Boolean(error);
  const currentEditorOpportunity = editor?.opportunity
    ? snapshot?.opportunities.find((item) => item.id === editor.opportunity?.id)
    : null;
  const editorUnavailable = Boolean(editor?.opportunity && !currentEditorOpportunity);

  return (
    <Surface padding="sm" className="space-y-4" aria-label="Negociações em conjunto">
      <div className="space-y-3">
        <div>
          <Heading level={3} className="flex items-center gap-2 text-base"><Link2 className="kds-control-icon" aria-hidden="true" />Negociações em conjunto</Heading>
          <Text className="mt-1 text-sm text-[var(--text-secondary)]">Reúna as pessoas que falam sobre a mesma contratação. Cada contato mantém sua conversa e seu histórico.</Text>
        </div>
        <Button variant="secondary" size="sm" disabled={disabled || Boolean(editor)} onClick={() => setEditor({ opportunity: null, requestId: crypto.randomUUID() })}><Plus className="kds-control-icon" aria-hidden="true" />Vincular contato</Button>
      </div>
      {error ? <Alert tone="danger"><Text>{error}</Text><Button variant="secondary" size="sm" className="mt-2" disabled={saving} onClick={() => void reload()}>Atualizar vínculos</Button></Alert> : null}
      <LoadingState active={loading} label="Consultando negociações deste contato..." fallback={() => <>
        {!error && snapshot?.opportunities.length === 0 ? <Text className="text-sm text-[var(--text-muted)]">Este contato ainda não participa de uma negociação em conjunto.</Text> : null}
        {snapshot?.truncated ? <Alert tone="warning">Mostrando as 20 negociações atualizadas mais recentemente. Este contato participa de outras negociações.</Alert> : null}
        {snapshot?.opportunities.map((opportunity) => <Surface key={opportunity.id} variant="muted" padding="sm" className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Heading level={4} className="break-words text-sm">{opportunity.name}</Heading>
            {opportunity.archived ? <Badge>Arquivada</Badge> : <Select aria-label={`Etapa de ${opportunity.name}`} value={opportunity.status} disabled={disabled} onChange={(event) => {
              if (isOpportunityStatus(event.target.value)) void mutate({ action: 'status', opportunityId: opportunity.id, expectedUpdatedAt: opportunity.updated_at, status: event.target.value });
            }} options={Object.entries(opportunityStatusLabels).map(([value, label]) => ({ value, label }))} />}
          </div>
          <Text className="text-xs text-[var(--text-secondary)]">O contato principal é a referência desta negociação. O contrato continua no cadastro da pessoa em que foi registrado.</Text>
          <ul className="space-y-2">
            {opportunity.members.map((member) => <li key={member.lead_id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[var(--bg-surface)] p-2">
              <div className="min-w-0 flex-1 basis-40">
                <Text className="break-words text-sm font-semibold">{member.name}{member.lead_id === lead.id ? ' (este contato)' : ''}</Text>
                {member.status ? <Text className="text-xs text-[var(--text-secondary)]">{member.status}</Text> : null}
                {member.lead_id === opportunity.primary_contact_lead_id ? <Badge tone="accent" size="sm" icon={Star}>Contato principal</Badge> : null}
              </div>
              {!opportunity.archived ? <div className="flex flex-wrap gap-1">
                {member.lead_id !== opportunity.primary_contact_lead_id ? <>
                  <Button variant="ghost" size="sm" disabled={disabled} onClick={() => void mutate({ action: 'primary', opportunityId: opportunity.id, expectedUpdatedAt: opportunity.updated_at, leadId: member.lead_id })} aria-label={`Definir ${member.name} como contato principal`}>Tornar principal</Button>
                  <IconButton variant="ghost" size="sm" disabled={disabled} aria-label={`Retirar vínculo de ${member.name}`} onClick={() => setRemoval({ opportunity, memberId: member.lead_id, memberName: member.name })}><Unlink className="kds-control-icon" /></IconButton>
                </> : null}
              </div> : null}
            </li>)}
          </ul>
          {opportunity.members_truncated ? <Alert tone="warning">Mostrando {opportunity.members.length} de {opportunity.member_count} contatos. A lista está incompleta.</Alert> : null}
          {!opportunity.archived ? <Button variant="secondary" size="sm" disabled={disabled || Boolean(editor) || opportunity.member_count >= 50} onClick={() => setEditor({ opportunity, requestId: crypto.randomUUID() })}><Plus className="kds-control-icon" aria-hidden="true" />Adicionar pessoa</Button> : null}
        </Surface>)}
      </>} />
      {editorUnavailable && !loading ? <Alert tone="warning">Esta negociação deixou de aparecer nos vínculos deste contato. Cancele a inclusão e confira os vínculos atualizados.</Alert> : null}
      {editor ? <RelationshipEditor key={editor.requestId} lead={lead} editor={{ ...editor, opportunity: currentEditorOpportunity ?? editor.opportunity }} disabled={disabled || editorUnavailable} saving={saving} onCancel={() => setEditor(null)} onSave={async (input) => {
        const saved = await mutate(input);
        if (saved) setEditor(null);
      }} /> : null}
      <ConfirmDialog open={Boolean(removal)} onOpenChange={(open) => { if (!open && !saving) setRemoval(null); }} title="Retirar vínculo da negociação" description={removal ? `Retirar ${removal.memberName} de “${removal.opportunity.name}”? A pessoa mantém seu cadastro, conversas e histórico.` : ''} confirmLabel="Retirar vínculo" loading={saving} onConfirm={async () => {
        if (!removal) return;
        const saved = await mutate({ action: 'remove', opportunityId: removal.opportunity.id, expectedUpdatedAt: removal.opportunity.updated_at, leadId: removal.memberId });
        if (saved) setRemoval(null);
      }}>{error ? <Alert tone="danger">{error}<Button variant="secondary" size="sm" onClick={() => { setRemoval(null); void reload(); }}>Fechar e atualizar vínculos</Button></Alert> : null}</ConfirmDialog>
    </Surface>
  );
}

function RelationshipEditor({ lead, editor, disabled, saving, onCancel, onSave }: {
  lead: LeadIdentity; editor: Editor; disabled: boolean; saving: boolean; onCancel: () => void;
  onSave: (input: Parameters<ReturnType<typeof useLeadOpportunities>['mutate']>[0]) => Promise<void>;
}) {
  const fieldId = useId();
  const [name, setName] = useState(`Contratação de ${lead.nome_completo}`.slice(0, 160));
  const [selected, setSelected] = useState<RelatedLead[]>([]);
  const [primary, setPrimary] = useState(lead.id);
  const [query, setQuery] = useState('');
  const { results, searching, searchError, retry } = useRelatedLeadSearch(query);
  // Reuse the same id for the same draft if the network response is uncertain.
  const draftRequest = useRef({ signature: '', id: editor.requestId });

  const excluded = new Set([lead.id, ...(editor.opportunity?.member_lead_ids ?? []), ...selected.map((item) => item.id)]);
  const candidates = results.filter((item) => !excluded.has(item.id));
  const maxSelection = editor.opportunity ? 1 : 49;
  const submit = async () => {
    if (disabled || selected.length === 0 || (!editor.opportunity && !name.trim())) return;
    if (editor.opportunity) {
      await onSave({ action: 'add', opportunityId: editor.opportunity.id, expectedUpdatedAt: editor.opportunity.updated_at, leadId: selected[0].id });
      return;
    }
    const draft = { name: name.trim(), memberLeadIds: [lead.id, ...selected.map((item) => item.id)], primaryContactLeadId: primary };
    const signature = JSON.stringify(draft);
    if (draftRequest.current.signature && draftRequest.current.signature !== signature) draftRequest.current.id = crypto.randomUUID();
    draftRequest.current.signature = signature;
    await onSave({ ...draft, clientRequestId: draftRequest.current.id });
  };

  return <Surface variant="muted" padding="sm" className="space-y-3" aria-label="Vincular pessoas à negociação">
    <Heading level={4} className="text-sm">{editor.opportunity ? `Adicionar pessoa a ${editor.opportunity.name}` : 'Nova negociação em conjunto'}</Heading>
    {!editor.opportunity ? <Field label="Nome da negociação" htmlFor={`${fieldId}-name`}><Input id={`${fieldId}-name`} value={name} maxLength={160} disabled={disabled} onChange={(event) => setName(event.target.value)} /></Field> : null}
    <Field label="Buscar contato por nome ou telefone" htmlFor={`${fieldId}-search`}><SearchInput id={`${fieldId}-search`} placeholder="Digite ao menos 2 caracteres" value={query} disabled={disabled || selected.length >= maxSelection} onChange={(event) => setQuery(event.target.value)} /></Field>
    {searchError ? <Alert tone="danger">{searchError}<Button variant="secondary" size="sm" onClick={retry}>Tentar novamente</Button></Alert> : null}
    {searching ? <Text role="status" className="text-sm text-[var(--text-secondary)]">Buscando contatos...</Text> : !searchError && query.trim().length >= 2 && selected.length < maxSelection ? <div className="max-h-48 space-y-1 overflow-y-auto">
      {candidates.length === 0 ? <Text className="text-sm text-[var(--text-muted)]">Nenhum outro contato encontrado. Pessoas já vinculadas ficam fora desta busca.</Text> : candidates.map((item) => <Button key={item.id} variant="secondary" className="w-full justify-start text-left" disabled={disabled} onClick={() => { setSelected((current) => [...current, item]); setQuery(''); }}><span className="min-w-0"><span className="block truncate">{item.name}</span><span className="block text-xs font-normal">{item.phone || 'Telefone não informado'}</span></span></Button>)}
      {results.length === 20 ? <Text className="text-xs text-[var(--text-secondary)]">Mostrando até 20 resultados. Refine o nome ou telefone para encontrar outra pessoa.</Text> : null}
    </div> : null}
    <div className="space-y-1">
      {!editor.opportunity ? <Text className="text-sm">{lead.nome_completo} (este contato)</Text> : null}
      {selected.map((item) => <div key={item.id} className="flex items-center justify-between gap-2"><Text className="text-sm">{item.name}</Text><IconButton variant="ghost" size="sm" disabled={disabled} aria-label={`Desmarcar ${item.name}`} onClick={() => { setSelected((current) => current.filter((person) => person.id !== item.id)); if (primary === item.id) setPrimary(lead.id); }}><X className="kds-control-icon" /></IconButton></div>)}
    </div>
    {!editor.opportunity && selected.length > 0 ? <Field label="Contato principal desta negociação" htmlFor={`${fieldId}-primary`}><Select id={`${fieldId}-primary`} value={primary} disabled={disabled} onChange={(event) => setPrimary(event.target.value)} options={[{ value: lead.id, label: lead.nome_completo }, ...selected.map((item) => ({ value: item.id, label: item.name }))]} /></Field> : null}
    <div className="flex flex-wrap justify-end gap-2"><Button variant="secondary" size="sm" disabled={saving} onClick={onCancel}>Cancelar</Button><Button variant="primary" size="sm" loading={saving} disabled={disabled || selected.length === 0 || (!editor.opportunity && !name.trim())} onClick={() => void submit()}>{editor.opportunity ? 'Adicionar pessoa' : 'Salvar vínculo'}</Button></div>
  </Surface>;
}
