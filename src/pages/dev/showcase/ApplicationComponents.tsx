import { useEffect, useRef, useState, type ComponentType } from 'react';
import {
  AppLoadingScreen, Audio, AutomationFlowsSkeleton, BlogTabSkeletonList, Button,
  CommissionCalendarSkeleton, ContractsPageSkeleton, DashboardPageSkeleton,
  DonutChart, DropdownOption, Field, FieldLabel, FileInput, Image, IntegrationsSkeleton,
  LeadsPageSkeleton, MonthlyTrendChart, OperadorasSkeleton, PanelAdaptiveLoadingFrame,
  PanelBootSkeleton, PositionedPopover, RemindersPageSkeleton, RichTextEditor,
  Select, Slider, SystemSettingsSkeleton, Text, TodoCalendarSkeleton,
  UsersSkeleton, VariableAutocompleteTextarea, Video, WhatsAppApiSkeleton,
  WhatsAppPageSkeleton, WorkflowBackground, WorkflowCanvas, WorkflowControls,
  DialogShell, PageContainer, PageHeader, Surface, WorkflowHandle, WorkflowMiniMap, WorkflowPanel,
} from '../../../design-system';
import { Position, type NodeProps } from 'reactflow';
import { Specimen, UsageNote } from './ShowcaseParts';

const skeletons: Record<string, ComponentType> = {
  'Inicialização': PanelBootSkeleton, 'Dashboard': DashboardPageSkeleton,
  'Contatos': LeadsPageSkeleton, 'Contratos': ContractsPageSkeleton,
  'Agenda': RemindersPageSkeleton, 'Conversas': WhatsAppPageSkeleton,
  'Conteúdo': BlogTabSkeletonList, 'Comissões': CommissionCalendarSkeleton,
  'Calendário': TodoCalendarSkeleton, 'Configurações': SystemSettingsSkeleton,
  'Operadoras': OperadorasSkeleton, 'Usuários': UsersSkeleton,
  'Integrações': IntegrationsSkeleton, 'Automações': AutomationFlowsSkeleton,
  'Canal de atendimento': WhatsAppApiSkeleton, 'Carregamento da aplicação': AppLoadingScreen,
};

function WorkflowExampleNode({ data }: NodeProps<{ label: string }>) {
  return <Surface padding="sm"><WorkflowHandle type="target" position={Position.Left} /><Text>{data.label}</Text><WorkflowHandle type="source" position={Position.Right} /></Surface>;
}
const workflowNodeTypes = { example: WorkflowExampleNode };

/** The same production components used in charts, imports, content and automation screens. */
export default function ApplicationComponents() {
  const [amount, setAmount] = useState('2.8');
  const [fileName, setFileName] = useState('Nenhum arquivo selecionado');
  const [content, setContent] = useState('<p>Prepare um atendimento claro e acolhedor.</p>');
  const [template, setTemplate] = useState('Olá, {{');
  const [skeleton, setSkeleton] = useState('Dashboard');
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [segment, setSegment] = useState('Todos os contatos');
  const [mediaUrl, setMediaUrl] = useState<string>();
  const [mediaType, setMediaType] = useState('');
  const [position, setPosition] = useState<{ top: number; left: number; width: number; maxHeight: number } | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => () => { if (mediaUrl) URL.revokeObjectURL(mediaUrl); }, [mediaUrl]);
  const SkeletonExample = skeletons[skeleton];

  return <>
    <UsageNote title="Um único contrato visual">
      Estes componentes são utilizados pelas telas de produção. A aparência oficial vale para todas as páginas e portais, sem ativação especial no catálogo. Os exemplos mantêm seus dados apenas nesta página.
    </UsageNote>
    <div className="ds-grid">
      <Specimen title="Cabeçalho e composição de página" description="O mesmo cabeçalho das páginas do CRM, sem estilos alternativos para o catálogo." source="PageContainer · PageHeader · DialogShell" wide>
        <PageContainer><PageHeader title="Atendimentos" description="Organize os próximos contatos." actions={<Button onClick={() => setDialogOpen(true)}>Consultar informações</Button>} /></PageContainer>
        <DialogShell isOpen={dialogOpen} onClose={() => setDialogOpen(false)} title="Informações do atendimento" description="Uma consulta rápida preserva o contexto da página." footer={<Button onClick={() => setDialogOpen(false)}>Concluir consulta</Button>}><Text>As informações deste exemplo ficam somente nesta prévia.</Text></DialogShell>
      </Specimen>
      <Specimen title="Arquivos e valores contínuos" description="Seleção de arquivo e controle de faixa compartilham foco, tokens e dimensões com os demais campos." source="FileInput · Slider · FieldLabel">
        <Field label="Documento do atendimento" description="Selecionar aqui não envia o arquivo ao CRM.">
          <FileInput aria-label="Documento do atendimento" onChange={(event) => setFileName(event.target.files?.[0]?.name ?? 'Nenhum arquivo selecionado')} />
        </Field>
        <Text size="sm" role="status">{fileName}</Text>
        <FieldLabel htmlFor="catalog-multiplier">Multiplicador: {amount}x</FieldLabel>
        <Slider id="catalog-multiplier" min="0" max="10" step="0.1" value={amount} onChange={(event) => setAmount(event.target.value)} />
      </Specimen>
      <Specimen title="Menus posicionados" description="A mesma superfície dos menus de conversa, com opções separadas e tema compartilhado." source="PositionedPopover · DropdownOption">
        <Button ref={trigger} variant="secondary" onClick={() => {
          if (position) { setPosition(null); return; }
          const rect = trigger.current?.getBoundingClientRect();
          if (rect) { const width = Math.min(320, window.innerWidth - 32); setPosition({ top: Math.min(rect.bottom + 8, window.innerHeight - 160), left: Math.max(16, Math.min(rect.left, window.innerWidth - width - 16)), width, maxHeight: window.innerHeight - 32 }); }
        }} aria-expanded={Boolean(position)} aria-haspopup="listbox">Escolher visualização</Button>
        <Text size="sm" role="status">{segment}</Text>
        <PositionedPopover isOpen={Boolean(position)} position={position} onClose={() => setPosition(null)} role="listbox" ariaLabel="Visualização da consulta" className="kds-menu-options">
          {['Todos os contatos', 'Meus atendimentos', 'Aguardando retorno'].map((label) => <DropdownOption key={label} aria-selected={segment === label} className={segment === label ? 'is-selected' : undefined} onClick={() => { setSegment(label); setPosition(null); trigger.current?.focus(); }}>{label}</DropdownOption>)}
        </PositionedPopover>
      </Specimen>
      <Specimen title="Gráficos do dashboard" description="Os gráficos reais de distribuição e tendência permitem consultar a mesma informação visual usada no painel." source="DonutChart · MonthlyTrendChart" wide>
        <DonutChart data={[{ label: 'Em atendimento', value: 12, color: 'var(--brand-primary)' }, { label: 'Contratados', value: 8, color: 'var(--success)' }]} size={160} onSegmentClick={setSegment} />
        <MonthlyTrendChart data={[{ label: 'Jan', value: 12 }, { label: 'Fev', value: 18 }, { label: 'Mar', value: 15 }, { label: 'Abr', value: 24 }]} />
      </Specimen>
      <Specimen title="Editor de conteúdo" description="A barra de edição e o conteúdo usam o editor real das publicações, com tema controlado pela biblioteca." source="RichTextEditor" wide>
        <RichTextEditor value={content} onChange={setContent} placeholder="Escreva uma orientação para o atendimento" />
        <Text size="sm">Prévia em somente leitura, como na visualização de publicações:</Text>
        <RichTextEditor className="kds-rich-text-preview" value={content} readOnly modules={{ toolbar: false }} />
      </Specimen>
      <Specimen title="Campos com variáveis" description="Digite duas chaves e escolha uma variável por clique ou pelas setas e Enter." source="VariableAutocompleteTextarea">
        <Field label="Mensagem com variáveis"><VariableAutocompleteTextarea value={template} onChange={setTemplate} suggestions={[{ key: 'nome', label: 'Nome do contato', description: 'Identificação do contato na mensagem' }, { key: 'saudacao', label: 'Saudação', description: 'Saudação conforme o horário' }]} /></Field>
      </Specimen>
      <Specimen title="Imagens e reprodução de mídia" description="Os mesmos elementos de imagem, áudio e vídeo usados nos documentos e conversas. Escolha um arquivo local para reproduzir; nada é enviado." source="Image · Audio · Video · FileInput">
        <Image src="/amil-logo-1-2.png" alt="Amil" fit="contain" className="kds-catalog-logo" />
        <Field label="Áudio ou vídeo de exemplo"><FileInput aria-label="Áudio ou vídeo de exemplo" accept="audio/*,video/*" onChange={(event) => { const file = event.target.files?.[0]; setMediaType(file?.type ?? ''); setMediaUrl(file ? URL.createObjectURL(file) : undefined); }} /></Field>
        {mediaType.startsWith('audio') ? <Audio controls src={mediaUrl} aria-label="Reproduzir áudio escolhido" /> : <Video controls src={mediaUrl} className="kds-catalog-media" aria-label="Reproduzir vídeo escolhido" />}
      </Specimen>
      <Specimen title="Canvas de fluxos" description="Navegue e ajuste o zoom no mesmo canvas utilizado por campanhas e automações." source="WorkflowCanvas · WorkflowControls · WorkflowBackground" wide>
        <div className="kds-catalog-workflow"><WorkflowCanvas nodeTypes={workflowNodeTypes} nodes={[{ id: 'start', type: 'example', position: { x: 0, y: 30 }, data: { label: 'Iniciar atendimento' } }, { id: 'follow', type: 'example', position: { x: 250, y: 30 }, data: { label: 'Organizar próximo passo' } }]} edges={[{ id: 'next', source: 'start', target: 'follow' }]} fitView nodesDraggable={false} nodesConnectable={false} deleteKeyCode={null}><WorkflowBackground color="var(--border-default)" /><WorkflowControls /><WorkflowMiniMap nodeColor="var(--brand-primary)" maskColor="var(--overlay)" /><WorkflowPanel position="top-right"><Text size="sm">Exemplo de sequência</Text></WorkflowPanel></WorkflowCanvas></div>
      </Specimen>
      <Specimen title="Carregamento das telas reais" description="Consulte os placeholders usados em cada módulo e o estado de carregamento compartilhado." source="ApplicationSkeletons · PanelAdaptiveLoadingFrame · AppLoadingScreen" wide>
        <Field label="Página em carregamento"><Select value={skeleton} options={Object.keys(skeletons).map((label) => ({ value: label, label }))} onChange={(event) => setSkeleton(event.target.value)} /></Field>
        <div className="kds-catalog-skeleton-viewer"><SkeletonExample /></div>
        <Button variant="secondary" onClick={() => setLoading(!loading)}>{loading ? 'Mostrar conteúdo' : 'Simular carregamento local'}</Button>
        <PanelAdaptiveLoadingFrame loading={loading} phase="skeleton" hasContent={!loading} skeleton={<SkeletonExample />}><Text>Conteúdo do exemplo disponível.</Text></PanelAdaptiveLoadingFrame>
      </Specimen>
    </div>
  </>;
}
