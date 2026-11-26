import { WhatsAppInboxDialog } from './WhatsAppInboxDialog';
import { Sparkles } from 'lucide-react';
import { Field, Select, Text } from '../../../../design-system';
import {
  Button,
  Surface,
  Textarea,
} from '../../../../design-system';
import type { CommWhatsAppRewriteTone } from '../data';

const TONE_OPTIONS: Array<{ value: CommWhatsAppRewriteTone; label: string; description: string }> = [
  {
    value: 'adapt_context',
    label: 'Adaptar ao contexto',
    description: 'Ajusta a mensagem ao histórico da conversa, como plural, nomes, combinados e momento atual.',
  },
  {
    value: 'grammar',
    label: 'Corrigir',
    description: 'Corrige gramática, ortografia e clareza sem mudar o sentido.',
  },
  {
    value: 'professional',
    label: 'Profissional',
    description: 'Deixa mais profissional e bem estruturada.',
  },
  {
    value: 'friendly',
    label: 'Amigável',
    description: 'Deixa mais calorosa e próxima do cliente.',
  },
  {
    value: 'shorter',
    label: 'Mais curta',
    description: 'Enxuga a mensagem mantendo o essencial.',
  },
  {
    value: 'assertive',
    label: 'Mais objetiva',
    description: 'Torna a mensagem mais direta e confiante.',
  },
];

type WhatsAppComposerRewriteModalProps = {
  isOpen: boolean;
  generating: boolean;
  sourceValue: string;
  value: string;
  tone: CommWhatsAppRewriteTone;
  customInstructions: string;
  onClose: () => void;
  onChangeSourceValue: (value: string) => void;
  onChangeValue: (value: string) => void;
  onChangeTone: (value: CommWhatsAppRewriteTone) => void;
  onChangeCustomInstructions: (value: string) => void;
  onGenerate: () => void;
  onApply: () => void;
};

export default function WhatsAppComposerRewriteModal({
  isOpen,
  generating,
  sourceValue,
  value,
  tone,
  customInstructions,
  onClose,
  onChangeSourceValue,
  onChangeValue,
  onChangeTone,
  onChangeCustomInstructions,
  onGenerate,
  onApply,
}: WhatsAppComposerRewriteModalProps) {
  return (
    <WhatsAppInboxDialog
      panelClassName="whatsapp-inbox-rewrite-dialog"
      isOpen={isOpen}
      onClose={onClose}
      title="Reescrever com IA"
      size="wide"
      footer={<><Button variant="secondary" onClick={onClose} disabled={generating}>Cancelar</Button><Button onClick={onApply} disabled={generating || !value.trim()}>Usar este texto</Button></>}
    >
      <div className="whatsapp-inbox-rewrite-grid">
        <div className="whatsapp-inbox-rewrite-fields">
          <Field label="Seu texto original">
            <Textarea value={sourceValue} onChange={(event) => onChangeSourceValue(event.target.value)} rows={7} placeholder="Digite a mensagem que você quer reescrever." disabled={generating} />
          </Field>
          <Field label="Tom da mensagem" hint={TONE_OPTIONS.find((option) => option.value === tone)?.description}>
            <Select value={tone} options={TONE_OPTIONS.map(({ value, label }) => ({ value, label }))} onChange={(event) => { const next = TONE_OPTIONS.find((option) => option.value === event.target.value); if (next) onChangeTone(next.value); }} disabled={generating} />
          </Field>
          <Field label="Instruções extras (opcional)">
            <Textarea value={customInstructions} onChange={(event) => onChangeCustomInstructions(event.target.value)} rows={3} placeholder="Ex.: não use emoji, termine com uma pergunta." disabled={generating} />
          </Field>
          <Button variant="secondary" onClick={onGenerate} loading={generating} disabled={!sourceValue.trim()}><Sparkles className="kds-control-icon" aria-hidden="true" />Gerar nova versão</Button>
        </div>
        <Surface variant="muted" padding="sm" className="whatsapp-inbox-rewrite-result">
          <Text className="whatsapp-inbox-rewrite-eyebrow"><Sparkles className="kds-control-icon" aria-hidden="true" /> Sugestão para revisar</Text>
          <Field label="Texto sugerido">
            <Textarea value={value} onChange={(event) => onChangeValue(event.target.value)} rows={12} placeholder="A mensagem reescrita vai aparecer aqui." disabled={generating} />
          </Field>
          <Text tone="muted" size="sm">Revise e edite o texto antes de usar. A mensagem não será enviada automaticamente.</Text>
        </Surface>
      </div>
    </WhatsAppInboxDialog>
  );
}
