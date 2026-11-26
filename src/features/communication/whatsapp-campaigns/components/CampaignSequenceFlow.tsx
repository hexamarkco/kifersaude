import { Text } from '../../../../design-system';
import { ActionSurface } from '../../../../design-system';
import { useMemo, useRef, useState, type ReactNode } from 'react';
import { WorkflowCanvas as ReactFlow, WorkflowBackground as Background, WorkflowHandle as Handle, WorkflowPanel as Panel } from '../../../../design-system';
import { MarkerType, Position, useReactFlow, type Edge, type Node, type NodeProps, type ReactFlowInstance } from 'reactflow';
import { Check, Clock3, Flag, Maximize2, MessageCircle, Paperclip, Play, Plus, ZoomIn, ZoomOut } from 'lucide-react';

import { Badge, Button, Dialog, DialogBody, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DisclosureTrigger, IconButton, Surface } from '../../../../design-system';
import type { CommWhatsAppCampaignStageDraft, CommWhatsAppCampaignStepKind } from '../commWhatsAppCampaignService';

type StageNodeData = {
  title: string;
  description: string;
  waitLabel: string;
  kind: CommWhatsAppCampaignStepKind;
  attachmentCount: number;
  alternativeCount: number;
  active: boolean;
  onSelect: () => void;
};

type BoundaryNodeData = { label: string; description: string; end?: boolean };

type CampaignSequenceFlowProps = {
  stages: CommWhatsAppCampaignStageDraft[];
  statusOptions: Array<{ value: string; label: string }>;
  interMessageIntervalSeconds: number;
  abTestEnabled: boolean;
  onAddStage: (kind: CommWhatsAppCampaignStepKind) => void;
  renderStageEditor: (stage: CommWhatsAppCampaignStageDraft, stageIndex: number) => ReactNode;
};

const STAGE_SPACING = 340;
const STAGE_START_X = 240;

const delayLabels = {
  seconds: ['segundo', 'segundos'],
  minutes: ['minuto', 'minutos'],
  hours: ['hora', 'horas'],
  days: ['dia', 'dias'],
};

const describeWait = (stage: CommWhatsAppCampaignStageDraft, index: number): string => {
  if (index === 0) return 'No início da campanha';
  if (stage.delayAmount <= 0) return 'Logo após a etapa anterior';
  const unit = delayLabels[stage.delayUnit][stage.delayAmount === 1 ? 0 : 1];
  return `Após ${stage.delayAmount} ${unit}`;
};

function StageNode({ data }: NodeProps<StageNodeData>) {
  const Icon = data.kind === 'message' ? MessageCircle : Flag;
  return (
    <div className="relative w-[264px]">
      <Handle type="target" position={Position.Left} isConnectable={false} className="!border-[color:var(--panel-surface)] !bg-[color:var(--panel-accent-strong)]" />
      <ActionSurface variant="plain" padding="none"
        type="button"
        onClick={data.onSelect}
        aria-pressed={data.active}
        aria-label={`Editar ${data.title}. ${data.waitLabel}. ${data.description}`}
        className={`nodrag nopan w-full rounded-[var(--kds-radius-lg)] border bg-[color:var(--panel-surface)] p-4 text-left shadow-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--panel-accent-strong)] ${data.active ? 'border-[color:var(--panel-accent-strong)] ring-2 ring-[color:var(--panel-accent-soft)]' : 'border-[color:var(--panel-border)] hover:border-[color:var(--panel-accent-strong)]'}`}
      >
        <span className="mb-3 flex items-center gap-1.5 text-xs text-[color:var(--panel-text-muted)]">
          <Clock3 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {data.waitLabel}
        </span>
        <span className="flex items-center gap-2 text-sm font-semibold text-[color:var(--panel-text)]">
          <Icon className="h-4 w-4 shrink-0 text-[color:var(--panel-accent-strong)]" aria-hidden="true" />
          {data.title}
        </span>
        <span className="mt-2 block line-clamp-3 whitespace-pre-wrap break-words text-xs leading-relaxed text-[color:var(--panel-text-soft)]">{data.description}</span>
        {(data.attachmentCount > 0 || data.alternativeCount > 1) && (
          <span className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[color:var(--panel-text-muted)]">
            {data.attachmentCount > 0 && <span className="inline-flex items-center gap-1"><Paperclip className="h-3 w-3" aria-hidden="true" />{data.attachmentCount} anexo(s)</span>}
            {data.alternativeCount > 1 && <span>{data.alternativeCount} variações independentes</span>}
          </span>
        )}
        <span className="mt-3 block text-xs font-medium text-[color:var(--panel-accent-strong)]">{data.active ? 'Em edição' : 'Selecionar para editar'}</span>
      </ActionSurface>
      <Handle type="source" position={Position.Right} isConnectable={false} className="!border-[color:var(--panel-surface)] !bg-[color:var(--panel-accent-strong)]" />
    </div>
  );
}

function BoundaryNode({ data }: NodeProps<BoundaryNodeData>) {
  const Icon = data.end ? Check : Play;
  return (
    <div className="relative w-[180px] rounded-[var(--kds-radius-lg)] border border-[color:var(--panel-border)] bg-[color:var(--panel-surface)] p-4">
      {data.end && <Handle type="target" position={Position.Left} isConnectable={false} className="!bg-[color:var(--panel-accent-strong)]" />}
      <Text className="flex items-center gap-2 text-sm font-semibold text-[color:var(--panel-text)]"><Icon className="h-4 w-4 text-[color:var(--panel-accent-strong)]" aria-hidden="true" />{data.label}</Text>
      <Text className="mt-2 text-xs text-[color:var(--panel-text-muted)]">{data.description}</Text>
      {!data.end && <Handle type="source" position={Position.Right} isConnectable={false} className="!bg-[color:var(--panel-accent-strong)]" />}
    </div>
  );
}

const nodeTypes = { campaignStage: StageNode, campaignBoundary: BoundaryNode };

function ViewControls() {
  const { zoomIn, zoomOut, fitView } = useReactFlow();
  return (
    <Panel position="bottom-left" className="flex gap-1 rounded-[var(--kds-radius-md)] border border-[color:var(--panel-border)] bg-[color:var(--panel-surface)] p-1">
      <IconButton size="sm" variant="ghost" aria-label="Aproximar sequência" title="Aproximar" onClick={() => void zoomIn({ duration: 200 })}><ZoomIn /></IconButton>
      <IconButton size="sm" variant="ghost" aria-label="Afastar sequência" title="Afastar" onClick={() => void zoomOut({ duration: 200 })}><ZoomOut /></IconButton>
      <IconButton size="sm" variant="ghost" aria-label="Ver sequência inteira" title="Ver sequência inteira" onClick={() => void fitView({ padding: 0.15, duration: 250 })}><Maximize2 /></IconButton>
    </Panel>
  );
}

export function CampaignSequenceFlow({ stages, statusOptions, interMessageIntervalSeconds, abTestEnabled, onAddStage, renderStageEditor }: CampaignSequenceFlowProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const flowRef = useRef<ReactFlowInstance | null>(null);
  const activeIndex = Math.min(selectedIndex ?? 0, Math.max(0, stages.length - 1));

  const selectStage = (index: number) => {
    setSelectedIndex(index);
    void flowRef.current?.setCenter(STAGE_START_X + index * STAGE_SPACING + 132, 180, { zoom: 0.9, duration: 250 });
  };

  const nodes: Node<StageNodeData | BoundaryNodeData>[] = [
    { id: 'start', type: 'campaignBoundary', position: { x: 0, y: 110 }, focusable: false, data: { label: 'Início', description: 'Na ativação ou no horário agendado.' } },
    ...stages.map((stage, index): Node<StageNodeData> => {
      const statusLabel = statusOptions.find((option) => option.value === stage.statusToSet)?.label || stage.statusToSet;
      const firstMessage = stage.messages.find((message) => message.messageText.trim());
      return {
        id: `stage-${index}`,
        type: 'campaignStage',
        position: { x: STAGE_START_X + index * STAGE_SPACING, y: 80 },
        focusable: false,
        data: {
          title: `${index + 1}. ${stage.kind === 'message' ? (abTestEnabled ? `Enviar mensagens · ${stage.messages.length} na copy A` : `Enviar ${stage.messages.length} mensagem(ns)`) : 'Mudar status'}`,
          description: stage.kind === 'status_change' ? (statusLabel ? `Novo status: ${statusLabel}` : 'Escolha o novo status do contato.') : firstMessage?.messageText || 'Escreva a mensagem ou anexe um arquivo.',
          waitLabel: describeWait(stage, index),
          kind: stage.kind,
          attachmentCount: stage.kind === 'message' ? stage.messages.filter((message) => message.mediaUrl).length : 0,
          alternativeCount: stage.kind === 'message' && abTestEnabled
            ? 1 + Object.keys(stages[0]?.variantMessages ?? {}).length
            : 1,
          active: selectedIndex !== null && index === activeIndex,
          onSelect: () => selectStage(index),
        },
      };
    }),
    { id: 'end', type: 'campaignBoundary', position: { x: STAGE_START_X + stages.length * STAGE_SPACING, y: 110 }, focusable: false, data: { label: 'Fim', description: 'Sequência concluída para este contato.', end: true } },
  ];

  const edges = useMemo((): Edge[] => {
    const ids = ['start', ...stages.map((_, index) => `stage-${index}`), 'end'];
    return ids.slice(1).map((target, index) => ({
      id: `${ids[index]}-${target}`,
      source: ids[index],
      target,
      type: 'smoothstep',
      markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--panel-accent-strong)' },
      style: { stroke: 'var(--panel-accent-strong)', strokeWidth: 2 },
      focusable: false,
    }));
  }, [stages]);

  const addStage = (kind: CommWhatsAppCampaignStepKind) => {
    onAddStage(kind);
    selectStage(stages.length);
  };

  return (
    <section className="space-y-3" aria-label="Editor visual da sequência do disparo">
      <ol className="kds-campaign-sequence">
        {stages.map((stage, index) => {
          const caption = stage.kind === 'message'
            ? stage.messages.find((message) => message.messageText.trim())?.messageText || (stage.messages.some((message) => message.mediaUrl) ? 'Mensagem com anexo' : 'Escreva a primeira mensagem desta etapa.')
            : statusOptions.find((option) => option.value === stage.statusToSet)?.label || stage.statusToSet || 'Escolha o status do lead.';
          return (
            <li key={index}>
              <Surface padding="sm" className="kds-campaign-sequence-row">
                <span className="kds-campaign-sequence-number">{String(index + 1).padStart(2, '0')}</span>
                <div>
                  <Badge size="sm">{describeWait(stage, index)}</Badge>
                  <Text weight="semibold">{stage.kind === 'message' ? (index === 0 ? 'Primeiro contato' : 'Mensagem de acompanhamento') : 'Mudança de status'}</Text>
                  <Text size="sm" tone="muted">{caption}</Text>
                </div>
                <Button variant="secondary" size="sm" onClick={() => selectStage(index)}>{stage.kind === 'message' ? 'Editar mensagem' : 'Editar etapa'}</Button>
              </Surface>
            </li>
          );
        })}
      </ol>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" onClick={() => addStage('message')}><Plus className="kds-control-icon" />Adicionar mensagens</Button>
        <Button size="sm" variant="secondary" onClick={() => addStage('status_change')}><Flag className="kds-control-icon" />Adicionar mudança de status</Button>
      </div>
      <details className="kds-campaign-sequence-map">
        <DisclosureTrigger size="sm">Mapa da sequência</DisclosureTrigger>
        <div className="h-[360px] min-w-0 overflow-hidden rounded-[var(--kds-radius-lg)] border border-[color:var(--panel-border)] bg-[color:var(--panel-surface-soft)] lg:h-[560px]" role="region" aria-label="Mapa da sequência de envio">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onInit={(instance) => {
              flowRef.current = instance;
              void instance.setCenter(STAGE_START_X + activeIndex * STAGE_SPACING + 132, 180, { zoom: 0.9 });
            }}
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable={false}
            edgesFocusable={false}
            deleteKeyCode={null}
            minZoom={0.1}
            maxZoom={1.5}
            zoomOnScroll={false}
            preventScrolling={false}
            disableKeyboardA11y
          >
            <Background color="var(--panel-border)" gap={20} />
            <ViewControls />
          </ReactFlow>
        </div>
      </details>
      {selectedIndex !== null && stages[activeIndex] && (
        <Dialog open size="wide" className="kds-crm-dialog kds-campaign-workspace kds-campaign-dialog kds-campaign-stage-dialog" onOpenChange={(open) => !open && setSelectedIndex(null)}>
          <DialogHeader onClose={() => setSelectedIndex(null)}>
            <div className="kds-dialog-eyebrow">Disparos</div>
            <DialogTitle>{stages[activeIndex].kind === 'message' ? 'Editar mensagem da campanha' : 'Editar mudança de status'}</DialogTitle>
            <DialogDescription placement="visible">Etapa {activeIndex + 1} · {describeWait(stages[activeIndex], activeIndex)}</DialogDescription>
          </DialogHeader>
          <DialogBody>{renderStageEditor(stages[activeIndex], activeIndex)}</DialogBody>
          <DialogFooter><Text className="kds-campaign-footer-note">Alterações ficam no rascunho até salvar a campanha.</Text><Button onClick={() => setSelectedIndex(null)}>Concluir edição</Button></DialogFooter>
        </Dialog>
      )}
      <Text className="text-xs text-[color:var(--panel-text-muted)]">Entre as mensagens da mesma etapa: {interMessageIntervalSeconds > 0 ? `espera mínima de ${interMessageIntervalSeconds} segundos` : 'cerca de 3 segundos'}. As etapas seguintes respeitam a espera indicada e podem parar se o contato responder.</Text>
    </section>
  );
}
