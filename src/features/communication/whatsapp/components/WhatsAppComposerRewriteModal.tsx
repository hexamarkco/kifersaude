import { Button, Surface, Textarea } from '../../../../design-system';
import type { CommWhatsAppRewriteTone } from '../../../../lib/commWhatsAppService';
import WhatsAppDialog from './WhatsAppDialog';

const TONE_OPTIONS: Array<{ value: CommWhatsAppRewriteTone; label: string; description: string }> = [
  {
    value: 'adapt_context',
    label: 'Adaptar ao contexto',
    description: 'Ajusta a mensagem ao histórico da conversa, como plural, nomes, combinados e momento atual.',
  },
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
    <WhatsAppDialog
      isOpen={isOpen}
      onClose={onClose}
      title="Reescrever mensagem com IA"
      description="Ajuste o objetivo, clique em reescrever e aplique o texto final no composer quando estiver bom."
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
          <Surface variant="muted" padding="sm">
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">Objetivo da reescrita</h3>
            <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">
              Escolha o ajuste principal. A IA preserva a intencao da mensagem e dados confirmados.
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
                      ? 'border-[var(--brand-primary)] bg-[var(--brand-primary-soft)] text-[var(--text-primary)]'
                      : 'border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:border-[var(--brand-primary)]'}`}
                  >
                    <p className="text-sm font-semibold">{option.label}</p>
                    <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">{option.description}</p>
                  </button>
                );
              })}
            </div>
          </Surface>

          <Surface padding="sm">
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">Instrucoes extras</h3>
            <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">
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
          </Surface>

          <Surface padding="sm">
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">Texto base</h3>
            <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">
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
          </Surface>
        </div>

        <div className="space-y-4">
          <Surface padding="sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">Sugestao da IA</h3>
                <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">
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
          </Surface>
        </div>
      </div>
    </WhatsAppDialog>
  );
}
