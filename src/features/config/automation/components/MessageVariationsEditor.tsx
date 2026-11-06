import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button, ButtonGroup } from '../../../../design-system';
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

  return (
    <div className="space-y-3">
      <div className="text-xs text-[var(--text-muted)]">
        {variations.length
          ? 'A cada execução, uma das variações é escolhida automaticamente. Somente as mensagens da variação escolhida são enviadas, em ordem. A mesma versão é mantida em novas tentativas.'
          : 'Crie variações para diversificar a abordagem dos leads. Cada versão pode ter uma ou mais mensagens.'}
      </div>
      <ButtonGroup className="flex-wrap" aria-label="Variações da abordagem">
        {[{ id: 'primary' }, ...variations].map((variation, index) => (
          <Button key={variation.id} type="button" size="sm"
            variant={activeId === variation.id ? 'primary' : 'secondary'}
            aria-pressed={activeId === variation.id} onClick={() => setSelectedId(variation.id)}>
            Variação {index + 1}
          </Button>
        ))}
        <Button type="button" size="sm" variant="text" onClick={() => {
          const id = crypto.randomUUID();
          onUpdate({
            messages: getAutoContactFlowMessageItems(step),
            messageVariations: [...variations, { id, messages: [{ custom: { type: 'text', text: '' } }] }],
          });
          setSelectedId(id);
        }}><Plus /> Adicionar variação</Button>
      </ButtonGroup>
      {selected && (
        <Button type="button" size="sm" variant="danger" onClick={() => {
          onUpdate({ messageVariations: variations.filter((variation) => variation.id !== selected.id) });
          setSelectedId('primary');
        }}><Trash2 /> Remover variação</Button>
      )}
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
