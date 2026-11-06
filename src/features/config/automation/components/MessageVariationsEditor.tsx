import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button, IconButton, Tabs, Text } from '../../../../design-system';
import { getAutoContactFlowMessageItems, type AutoContactFlowStep, type AutoContactTemplate } from '../../../../lib/autoContactService';
import { MessageListEditor } from './MessageListEditor';

type Props = {
  step: AutoContactFlowStep;
  messageTemplates: AutoContactTemplate[];
  onUpdate: (updates: Partial<AutoContactFlowStep>) => void;
  onPreviewAiMessage?: (instruction: string, itemIndex: number) => Promise<string>;
};

export function MessageVariationsEditor(props: Props) {
  // Remount on step changes so selection never leaks into another action.
  return <VariationEditor key={props.step.id} {...props} />;
}

function VariationEditor({ step, messageTemplates, onUpdate, onPreviewAiMessage }: Props) {
  const [selectedId, setSelectedId] = useState('primary');
  const variations = step.messageVariations ?? [];
  const selected = variations.find((variation) => variation.id === selectedId);
  const activeId = selected?.id ?? 'primary';
  const activeMessages = selected?.messages ?? getAutoContactFlowMessageItems(step);
  const activeIndex = selected ? variations.indexOf(selected) + 2 : 1;

  return (
    <div className="min-w-0 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Text size="sm" weight="semibold" tone="primary">Variações da abordagem</Text>
        <Button type="button" size="sm" variant="secondary" className="shrink-0" onClick={() => {
          const id = crypto.randomUUID();
          onUpdate({
            messages: getAutoContactFlowMessageItems(step),
            messageVariations: [...variations, { id, messages: [{ custom: { type: 'text', text: '' } }] }],
          });
          setSelectedId(id);
        }}><Plus /> Adicionar variação</Button>
      </div>
      <Text size="xs" tone="muted">
        {variations.length
          ? 'Uma versão é escolhida automaticamente por execução. As mensagens são enviadas em ordem, mantendo a mesma versão em novas tentativas.'
          : 'Crie outras versões da abordagem. Cada uma pode ter uma ou mais mensagens.'}
      </Text>
      <Tabs
        items={[{ id: 'primary' }, ...variations].map((variation, index) => ({ id: variation.id, label: `Variação ${index + 1}` }))}
        value={activeId} onChange={setSelectedId} size="sm" variant="underline"
        ariaLabel="Variações da abordagem" className="min-w-0"
        listClassName="flex-nowrap gap-1 overflow-x-auto"
        triggerClassName="shrink-0 whitespace-nowrap"
      />
      <div className="flex min-h-11 items-center justify-between gap-3">
        <Text size="xs" tone="muted" aria-live="polite">
          Variação {activeIndex} · {activeMessages.length} {activeMessages.length === 1 ? 'mensagem' : 'mensagens'}
        </Text>
        {selected && (
          <IconButton type="button" size="sm" variant="ghost"
            aria-label="Remover variação" title={`Remover variação ${activeIndex}`} onClick={() => {
              onUpdate({ messageVariations: variations.filter((variation) => variation.id !== selected.id) });
              setSelectedId('primary');
            }}><Trash2 /></IconButton>
        )}
      </div>
      <MessageListEditor key={activeId}
        step={selected ? { ...step, id: `${step.id}-${activeId}`, messages: selected.messages } : step}
        messageTemplates={messageTemplates}
        onUpdate={(messages) => onUpdate(selected
          ? { messageVariations: variations.map((variation) => variation.id === selected.id ? { ...variation, messages } : variation) }
          : { messages })}
        onPreviewAiMessage={onPreviewAiMessage}
      />
    </div>
  );
}
