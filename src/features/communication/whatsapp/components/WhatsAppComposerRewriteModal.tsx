import Button from '../../../../components/ui/Button';
import ModalShell from '../../../../components/ui/ModalShell';
import Textarea from '../../../../components/ui/Textarea';
import type { CommWhatsAppRewriteTone } from '../../../../lib/commWhatsAppService';

const TONE_OPTIONS: Array<{ value: CommWhatsAppRewriteTone; label: string; description: string }> = [
  {
    value: 'grammar',
    label: 'Corrigir',
    description: 'Corrige gramatica, ortografia e clareza sem mudar o sentido.',
  },
  {
    value: 'professional',
    label: 'Profissional',
    description: 'Deixa mais profissional e bem estruturada.',
  },
  {
    value: 'friendly',
    label: 'Amigavel',
    description: 'Deixa mais calorosa e proxima do cliente.',
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
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      title="Reescrever mensagem com IA"
      description="Ajuste o tom, refine com instrucoes extras e aplique o texto final no composer quando estiver bom."
      size="xl"
      panelClassName="max-w-5xl"
      footer={(
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose} disabled={generating}>
            Fechar
          </Button>
          <Button variant="secondary" onClick={onGenerate} loading={generating} disabled={!sourceValue.trim()}>
            Reescrever
          </Button>
          <Button onClick={onApply} disabled={generating || !value.trim()}>
            Aplicar no composer
          </Button>
        </div>
      )}
    >
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <div className="rounded-2xl border border-[var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface-soft,#f8f2e9)] p-4">
            <h3 className="text-sm font-semibold text-[var(--panel-text,#1a120d)]">Objetivo da reescrita</h3>
            <p className="mt-1 text-xs leading-5 text-[var(--panel-text-muted,#876f5c)]">
              Escolha o ajuste principal. A IA preserva a intencao da mensagem.
            </p>
            <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
              {TONE_OPTIONS.map((option) => {
                const active = tone === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => onChangeTone(option.value)}
                    className={`rounded-2xl border px-3 py-3 text-left transition ${active
                      ? 'border-[var(--panel-accent-border,#d2ab85)] bg-[var(--panel-accent-soft,#f4e2cc)]/75 text-[var(--panel-text,#1a120d)]'
                      : 'border-[var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface,#fffdfa)] text-[var(--panel-text-soft,#5b4635)] hover:border-[var(--panel-accent-border,#d2ab85)]'}`}
                  >
                    <p className="text-sm font-semibold">{option.label}</p>
                    <p className="mt-1 text-xs leading-5 text-[var(--panel-text-muted,#876f5c)]">{option.description}</p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface,#fffdfa)] p-4">
            <h3 className="text-sm font-semibold text-[var(--panel-text,#1a120d)]">Instrucoes extras</h3>
            <p className="mt-1 text-xs leading-5 text-[var(--panel-text-muted,#876f5c)]">
              Opcional. Ex.: nao use emoji, termine com pergunta objetiva, mantenha linguagem simples.
            </p>
            <Textarea
              value={customInstructions}
              onChange={(event) => onChangeCustomInstructions(event.target.value)}
              rows={4}
              className="mt-3 text-sm leading-6"
              placeholder="Adicione instrucoes extras so para esta reescrita."
              disabled={generating}
            />
          </div>

          <div className="rounded-2xl border border-[var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface,#fffdfa)] p-4">
            <h3 className="text-sm font-semibold text-[var(--panel-text,#1a120d)]">Texto base</h3>
            <p className="mt-1 text-xs leading-5 text-[var(--panel-text-muted,#876f5c)]">
              Voce pode ajustar o texto aqui antes de pedir uma nova reescrita.
            </p>
            <Textarea
              value={sourceValue}
              onChange={(event) => onChangeSourceValue(event.target.value)}
              rows={8}
              className="mt-3 text-sm leading-6"
              placeholder="Digite a mensagem que voce quer reescrever."
              disabled={generating}
            />
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-[var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface,#fffdfa)] p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-[var(--panel-text,#1a120d)]">Sugestao da IA</h3>
                <p className="mt-1 text-xs leading-5 text-[var(--panel-text-muted,#876f5c)]">
                  Revise e edite livremente antes de aplicar no composer.
                </p>
              </div>
            </div>
            <Textarea
              value={value}
              onChange={(event) => onChangeValue(event.target.value)}
              rows={18}
              className="mt-3 min-h-[360px] text-sm leading-6"
              placeholder="A mensagem reescrita vai aparecer aqui."
              disabled={generating}
            />
          </div>
        </div>
      </div>
    </ModalShell>
  );
}
