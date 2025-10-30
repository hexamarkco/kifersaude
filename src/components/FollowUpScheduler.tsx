import { useState } from 'react';
import { X, Calendar, Clock } from 'lucide-react';
import { supabase, Lead } from '../lib/supabase';
import { convertLocalToUTC } from '../lib/dateUtils';

type FollowUpSchedulerProps = {
  lead: Lead;
  onClose: () => void;
  onScheduled: () => void;
};

export default function FollowUpScheduler({ lead, onClose, onScheduled }: FollowUpSchedulerProps) {
  const [followUpDate, setFollowUpDate] = useState(() => {
    const now = new Date();
    now.setDate(now.getDate() + 3);
    now.setHours(10, 0, 0, 0);
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  });
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSchedule = async () => {
    if (!followUpDate) {
      alert('Por favor, selecione uma data e hora para o follow-up');
      return;
    }

    setSaving(true);
    try {
      await supabase
        .from('leads')
        .update({
          proximo_retorno: convertLocalToUTC(followUpDate),
          ultimo_contato: new Date().toISOString()
        })
        .eq('id', lead.id);

      const reminderDate = new Date(followUpDate);
      reminderDate.setMinutes(reminderDate.getMinutes() - 1);

      const existingReminder = await supabase
        .from('reminders')
        .select('id')
        .eq('lead_id', lead.id)
        .eq('tipo', 'Retorno')
        .eq('lido', false)
        .maybeSingle();

      if (existingReminder.data) {
        await supabase
          .from('reminders')
          .update({
            titulo: `Follow-up proposta: ${lead.nome_completo}`,
            descricao: notes || `Follow-up da proposta enviada para ${lead.nome_completo}. Telefone: ${lead.telefone}`,
            data_lembrete: reminderDate.toISOString(),
            prioridade: 'alta'
          })
          .eq('id', existingReminder.data.id);
      } else {
        await supabase
          .from('reminders')
          .insert([{
            lead_id: lead.id,
            tipo: 'Retorno',
            titulo: `Follow-up proposta: ${lead.nome_completo}`,
            descricao: notes || `Follow-up da proposta enviada para ${lead.nome_completo}. Telefone: ${lead.telefone}`,
            data_lembrete: reminderDate.toISOString(),
            lido: false,
            prioridade: 'alta'
          }]);
      }

      if (notes) {
        await supabase
          .from('interactions')
          .insert([{
            lead_id: lead.id,
            tipo: 'Observação',
            descricao: `Follow-up agendado: ${notes}`,
            responsavel: lead.responsavel,
          }]);
      }

      onScheduled();
    } catch (error) {
      console.error('Erro ao agendar follow-up:', error);
      alert('Erro ao agendar follow-up');
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = () => {
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
        <div className="bg-gradient-to-r from-orange-500 to-orange-600 px-6 py-4 flex items-center justify-between rounded-t-xl">
          <div className="flex items-center space-x-3">
            <div className="bg-white bg-opacity-20 p-2 rounded-lg">
              <Calendar className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">Agendar Follow-up</h3>
              <p className="text-orange-100 text-sm">Proposta enviada para {lead.nome_completo}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        <div className="p-6">
          <div className="mb-6 bg-orange-50 border border-orange-200 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <Clock className="w-5 h-5 text-orange-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-orange-900 mb-1">
                  Não esqueça de fazer o follow-up!
                </p>
                <p className="text-xs text-orange-700">
                  Agende um lembrete para acompanhar esta proposta e aumentar suas chances de fechamento.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Quando deseja fazer o follow-up? *
              </label>
              <input
                type="datetime-local"
                value={followUpDate}
                onChange={(e) => setFollowUpDate(e.target.value)}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                required
              />
              <p className="text-xs text-slate-500 mt-1">
                Recomendado: 2-3 dias após o envio da proposta
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Observações (opcional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Ex: Cliente pediu para ligar após revisar a proposta..."
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none"
              />
            </div>
          </div>

          <div className="flex items-center space-x-3 mt-6 pt-6 border-t border-slate-200">
            <button
              type="button"
              onClick={handleSkip}
              className="flex-1 px-4 py-3 text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors font-medium"
            >
              Pular
            </button>
            <button
              onClick={handleSchedule}
              disabled={saving}
              className="flex-1 px-4 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Agendando...' : 'Agendar Follow-up'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
