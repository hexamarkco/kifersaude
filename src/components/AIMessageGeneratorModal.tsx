import { useState, useEffect } from 'react';
import { X, Loader, Send, Sparkles, RefreshCw, Edit3, MessageCircle } from 'lucide-react';
import { Reminder, Lead, Contract } from '../lib/supabase';
import { zapiService, ZAPIMessage } from '../lib/zapiService';
import { gptService } from '../lib/gptService';
import WhatsAppConversationViewer from './WhatsAppConversationViewer';
import { useAuth } from '../contexts/AuthContext';

interface AIMessageGeneratorModalProps {
  reminder: Reminder;
  lead: Lead;
  contract?: Contract;
  onClose: () => void;
  onMessageSent: () => void;
}

type Step = 'loading-history' | 'generating' | 'preview' | 'sending' | 'success' | 'error';
type Tone = 'professional' | 'friendly' | 'urgent' | 'casual';

export default function AIMessageGeneratorModal({
  reminder,
  lead,
  contract,
  onClose,
  onMessageSent,
}: AIMessageGeneratorModalProps) {
  const { user } = useAuth();
  const [step, setStep] = useState<Step>('loading-history');
  const [conversationHistory, setConversationHistory] = useState<ZAPIMessage[]>([]);
  const [generatedMessage, setGeneratedMessage] = useState('');
  const [editedMessage, setEditedMessage] = useState('');
  const [selectedTone, setSelectedTone] = useState<Tone>('professional');
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [savedMessageId, setSavedMessageId] = useState<string | null>(null);

  useEffect(() => {
    loadConversationHistory();
  }, []);

  const loadConversationHistory = async () => {
    setStep('loading-history');
    setError(null);

    try {
      const result = await zapiService.fetchAndSaveHistory(
        lead.id,
        lead.telefone,
        contract?.id
      );

      if (!result.success) {
        setError(result.error || 'Erro ao buscar histórico');
        setStep('error');
        return;
      }

      setConversationHistory(result.messages);
      generateMessage(result.messages);
    } catch (err) {
      setError('Erro ao carregar histórico de conversas');
      setStep('error');
    }
  };

  const generateMessage = async (history?: ZAPIMessage[]) => {
    setStep('generating');
    setError(null);

    try {
      const result = await gptService.generateMessage({
        reminder,
        lead,
        contract,
        conversationHistory: history || conversationHistory,
        tone: selectedTone,
      });

      if (!result.success) {
        setError(result.error || 'Erro ao gerar mensagem');
        setStep('error');
        return;
      }

      setGeneratedMessage(result.message || '');
      setEditedMessage(result.message || '');

      const saveResult = await gptService.saveGeneratedMessage(
        reminder.id,
        lead.id,
        result.message || '',
        'prompt gerado automaticamente',
        history || conversationHistory,
        result.tokensUsed || 0,
        result.costEstimate || 0,
        selectedTone,
        user?.email || 'unknown',
        contract?.id
      );

      if (saveResult.success && saveResult.messageId) {
        setSavedMessageId(saveResult.messageId);
      }

      setStep('preview');
    } catch (err) {
      setError('Erro ao gerar mensagem com IA');
      setStep('error');
    }
  };

  const handleRegenerate = () => {
    generateMessage();
  };

  const handleApproveAndSend = async () => {
    if (!editedMessage.trim()) {
      setError('Mensagem não pode estar vazia');
      return;
    }

    setStep('sending');
    setError(null);

    try {
      if (savedMessageId) {
        await gptService.updateMessageStatus(
          savedMessageId,
          'approved',
          editedMessage !== generatedMessage ? editedMessage : undefined,
          user?.email
        );
      }

      const result = await zapiService.sendTextMessage(lead.telefone, editedMessage);

      if (!result.success) {
        if (savedMessageId) {
          await gptService.updateMessageStatus(
            savedMessageId,
            'failed',
            undefined,
            undefined,
            result.error
          );
        }
        setError(result.error || 'Erro ao enviar mensagem');
        setStep('error');
        return;
      }

      if (savedMessageId) {
        await gptService.updateMessageStatus(savedMessageId, 'sent');
      }

      setStep('success');
      setTimeout(() => {
        onMessageSent();
        onClose();
      }, 2000);
    } catch (err) {
      setError('Erro ao enviar mensagem');
      setStep('error');
    }
  };

  const toneOptions: { value: Tone; label: string; description: string }[] = [
    { value: 'professional', label: 'Profissional', description: 'Formal e cordial' },
    { value: 'friendly', label: 'Amigável', description: 'Descontraído e próximo' },
    { value: 'urgent', label: 'Urgente', description: 'Transmite importância' },
    { value: 'casual', label: 'Casual', description: 'Conversa informal' },
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="bg-gradient-to-r from-teal-600 to-purple-600 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Sparkles className="w-6 h-6" />
            <div>
              <h2 className="text-xl font-bold">Gerar Mensagem com IA</h2>
              <p className="text-sm text-teal-100">{lead.nome_completo}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-white/20 rounded-lg p-2 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {(step === 'loading-history' || step === 'generating') && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader className="w-16 h-16 text-teal-600 animate-spin mb-4" />
              <p className="text-lg font-medium text-slate-700">
                {step === 'loading-history' ? 'Carregando histórico de conversas...' : 'Gerando mensagem com IA...'}
              </p>
              <p className="text-sm text-slate-500 mt-2">
                {step === 'loading-history' ? 'Conectando ao Z-API' : 'Processando com GPT'}
              </p>
            </div>
          )}

          {step === 'error' && (
            <div className="bg-red-50 border-2 border-red-200 rounded-xl p-6 text-center">
              <div className="text-red-600 text-5xl mb-4">⚠️</div>
              <h3 className="text-xl font-bold text-red-900 mb-2">Erro</h3>
              <p className="text-red-700 mb-4">{error}</p>
              <div className="flex justify-center space-x-3">
                <button
                  onClick={() => loadConversationHistory()}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  Tentar Novamente
                </button>
                <button
                  onClick={onClose}
                  className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors"
                >
                  Fechar
                </button>
              </div>
            </div>
          )}

          {step === 'preview' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-bold text-slate-900 mb-3 flex items-center space-x-2">
                  <MessageCircle className="w-5 h-5 text-teal-600" />
                  <span>Histórico da Conversa</span>
                </h3>
                <WhatsAppConversationViewer
                  messages={conversationHistory}
                  leadName={lead.nome_completo}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-bold text-slate-900 flex items-center space-x-2">
                    <Sparkles className="w-5 h-5 text-purple-600" />
                    <span>Mensagem Gerada pela IA</span>
                  </h3>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setIsEditing(!isEditing)}
                      className="flex items-center space-x-1 px-3 py-1.5 text-sm bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
                    >
                      <Edit3 className="w-4 h-4" />
                      <span>{isEditing ? 'Cancelar' : 'Editar'}</span>
                    </button>
                    <button
                      onClick={handleRegenerate}
                      className="flex items-center space-x-1 px-3 py-1.5 text-sm bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors"
                    >
                      <RefreshCw className="w-4 h-4" />
                      <span>Regenerar</span>
                    </button>
                  </div>
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Tom de voz:
                  </label>
                  <div className="grid grid-cols-4 gap-3">
                    {toneOptions.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => setSelectedTone(option.value)}
                        className={`p-3 rounded-lg border-2 transition-all ${
                          selectedTone === option.value
                            ? 'border-teal-600 bg-teal-50 text-teal-900'
                            : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                        }`}
                      >
                        <p className="font-medium text-sm">{option.label}</p>
                        <p className="text-xs text-slate-500 mt-1">{option.description}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {isEditing ? (
                  <textarea
                    value={editedMessage}
                    onChange={(e) => setEditedMessage(e.target.value)}
                    rows={8}
                    className="w-full px-4 py-3 border-2 border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-none font-mono text-sm"
                  />
                ) : (
                  <div className="bg-gradient-to-br from-slate-50 to-white border-2 border-slate-200 rounded-lg p-4">
                    <p className="whitespace-pre-wrap text-slate-900">{editedMessage}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {step === 'sending' && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader className="w-16 h-16 text-teal-600 animate-spin mb-4" />
              <p className="text-lg font-medium text-slate-700">Enviando mensagem...</p>
              <p className="text-sm text-slate-500 mt-2">Aguarde...</p>
            </div>
          )}

          {step === 'success' && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="text-green-600 text-6xl mb-4">✓</div>
              <h3 className="text-2xl font-bold text-green-900 mb-2">Mensagem Enviada!</h3>
              <p className="text-green-700">A mensagem foi enviada com sucesso para {lead.nome_completo}</p>
            </div>
          )}
        </div>

        {step === 'preview' && (
          <div className="bg-slate-50 px-6 py-4 flex items-center justify-between border-t border-slate-200">
            <button
              onClick={onClose}
              className="px-5 py-2.5 text-slate-700 hover:bg-slate-200 rounded-lg transition-colors font-medium"
            >
              Cancelar
            </button>
            <button
              onClick={handleApproveAndSend}
              disabled={!editedMessage.trim()}
              className="flex items-center space-x-2 px-6 py-2.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              <Send className="w-5 h-5" />
              <span>Aprovar e Enviar</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
