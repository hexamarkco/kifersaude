import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronDown, Loader2, Sparkles, XCircle } from 'lucide-react';

import { Alert, Badge, Button, Surface } from '../../../../design-system';
import { commWhatsAppService, type CommWhatsAppAttendanceCritique } from '../../../../lib/commWhatsAppService';

type WhatsAppAttendanceCritiquePanelProps = {
  chatId: string | null;
  isActive: boolean;
};

const AVALIACAO_LABEL: Record<CommWhatsAppAttendanceCritique['avaliacaoGeral'], string> = {
  excelente: 'Excelente',
  boa: 'Boa',
  regular: 'Regular',
  precisa_melhorar: 'Precisa melhorar',
};

const AVALIACAO_TONE: Record<CommWhatsAppAttendanceCritique['avaliacaoGeral'], 'success' | 'accent' | 'gold' | 'warning'> = {
  excelente: 'success',
  boa: 'accent',
  regular: 'gold',
  precisa_melhorar: 'warning',
};

const formatDateTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

export default function WhatsAppAttendanceCritiquePanel({ chatId, isActive }: WhatsAppAttendanceCritiquePanelProps) {
  const [critiques, setCritiques] = useState<CommWhatsAppAttendanceCritique[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  useEffect(() => {
    setCritiques([]);
    setSelectedId(null);
    setShowHistory(false);
    setGenerateError(null);
    setListError(null);
  }, [chatId]);

  useEffect(() => {
    if (!isActive || !chatId) return;

    let cancelled = false;
    setListLoading(true);
    setListError(null);

    commWhatsAppService
      .listAttendanceCritiques(chatId)
      .then((result) => {
        if (cancelled) return;
        setCritiques(result);
        setSelectedId(result[0]?.id ?? null);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setListError(error instanceof Error ? error.message : 'Nao foi possivel carregar as analises deste atendimento.');
      })
      .finally(() => {
        if (!cancelled) setListLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isActive, chatId]);

  const handleGenerate = async () => {
    if (!chatId || generating) return;
    setGenerating(true);
    setGenerateError(null);

    try {
      const critique = await commWhatsAppService.critiqueAttendance({ chatId });
      setCritiques((prev) => [critique, ...prev]);
      setSelectedId(critique.id);
      setShowHistory(false);
    } catch (error) {
      setGenerateError(error instanceof Error ? error.message : 'Nao foi possivel gerar a analise do atendimento.');
    } finally {
      setGenerating(false);
    }
  };

  const selected = critiques.find((item) => item.id === selectedId) ?? critiques[0] ?? null;
  const previousCritiques = critiques.filter((item) => item.id !== selected?.id);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Análise do atendimento</h3>
          <p className="mt-0.5 text-xs text-[var(--text-muted)]">
            A IA avalia como este atendimento foi conduzido, apontando acertos, pontos de atenção e erros.
          </p>
        </div>
        <Button variant="primary" size="sm" onClick={() => void handleGenerate()} loading={generating} disabled={!chatId || generating}>
          <Sparkles className="h-4 w-4" />
          Analisar atendimento
        </Button>
      </div>

      {generateError ? (
        <Alert tone="danger">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="text-sm">{generateError}</span>
          </div>
        </Alert>
      ) : null}

      {listLoading ? (
        <div className="flex items-center justify-center py-10 text-sm text-[var(--text-muted)]">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Carregando análises...
        </div>
      ) : listError ? (
        <Alert tone="danger">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="text-sm">{listError}</span>
          </div>
        </Alert>
      ) : !selected ? (
        <Surface padding="md" className="text-center text-sm text-[var(--text-muted)]">
          Nenhuma análise gerada ainda para este atendimento.
        </Surface>
      ) : (
        <div className="flex flex-col gap-3">
          <Surface padding="md" className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <Badge tone={AVALIACAO_TONE[selected.avaliacaoGeral]}>{AVALIACAO_LABEL[selected.avaliacaoGeral]}</Badge>
              <span className="text-xs text-[var(--text-muted)]">{formatDateTime(selected.generatedAt)}</span>
            </div>
            <p className="text-sm text-[var(--text-primary)]">{selected.resumo}</p>
          </Surface>

          <Alert tone="success">
            <p className="mb-2 flex items-center gap-2 font-semibold text-[var(--text-primary)]">
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              Pontos fortes
            </p>
            {selected.pontosFortes.length > 0 ? (
              <ul className="space-y-1.5 text-sm">
                {selected.pontosFortes.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-[var(--text-muted)]">Nenhum ponto forte destacado.</p>
            )}
          </Alert>

          <Alert tone="warning">
            <p className="mb-2 flex items-center gap-2 font-semibold text-[var(--text-primary)]">
              <AlertTriangle className="h-4 w-4" aria-hidden="true" />
              Pontos de atenção
            </p>
            {selected.pontosDeAtencao.length > 0 ? (
              <ul className="space-y-1.5 text-sm">
                {selected.pontosDeAtencao.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-[var(--text-muted)]">Nenhum ponto de atenção identificado.</p>
            )}
          </Alert>

          <Alert tone="danger">
            <p className="mb-2 flex items-center gap-2 font-semibold text-[var(--text-primary)]">
              <XCircle className="h-4 w-4" aria-hidden="true" />
              Erros
            </p>
            {selected.erros.length > 0 ? (
              <ul className="space-y-1.5 text-sm">
                {selected.erros.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-[var(--text-muted)]">Nenhum erro identificado.</p>
            )}
          </Alert>

          <p className="text-xs text-[var(--text-muted)]">
            Sessão de {formatDateTime(selected.sessionStartedAt)} até {formatDateTime(selected.sessionEndedAt)} ·{' '}
            {selected.messageCount} mensagens · {selected.provider}/{selected.model}
          </p>

          {previousCritiques.length > 0 ? (
            <div>
              <button
                type="button"
                onClick={() => setShowHistory((prev) => !prev)}
                className="flex items-center gap-1 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showHistory ? 'rotate-180' : ''}`} aria-hidden="true" />
                Análises anteriores ({previousCritiques.length})
              </button>
              {showHistory ? (
                <div className="mt-2 flex flex-col gap-1.5">
                  {previousCritiques.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSelectedId(item.id)}
                      className="flex items-center justify-between gap-2 rounded-xl border border-[var(--border-subtle)] px-3 py-2 text-left text-xs hover:bg-[var(--bg-hover)]"
                    >
                      <span className="text-[var(--text-muted)]">{formatDateTime(item.generatedAt)}</span>
                      <Badge tone={AVALIACAO_TONE[item.avaliacaoGeral]} size="xs">{AVALIACAO_LABEL[item.avaliacaoGeral]}</Badge>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
