import { useState } from 'react';
import { supabase, Lead } from '../lib/supabase';
import { X, Search } from 'lucide-react';
import { formatDateTimeForInput, convertLocalToUTC } from '../lib/dateUtils';
import { consultarCep, formatCep } from '../lib/cepService';

type LeadFormProps = {
  lead: Lead | null;
  onClose: () => void;
  onSave: () => void;
};

export default function LeadForm({ lead, onClose, onSave }: LeadFormProps) {
  const [formData, setFormData] = useState({
    nome_completo: lead?.nome_completo || '',
    telefone: lead?.telefone || '',
    email: lead?.email || '',
    cep: '',
    endereco: '',
    cidade: lead?.cidade || '',
    estado: '',
    regiao: lead?.regiao || '',
    origem: lead?.origem || 'tráfego pago',
    tipo_contratacao: lead?.tipo_contratacao || 'Pessoa Física',
    operadora_atual: lead?.operadora_atual || '',
    status: lead?.status || 'Novo',
    responsavel: lead?.responsavel || 'Luiza',
    proximo_retorno: formatDateTimeForInput(lead?.proximo_retorno),
    observacoes: lead?.observacoes || '',
  });
  const [saving, setSaving] = useState(false);
  const [loadingCep, setLoadingCep] = useState(false);

  const handleCepSearch = async () => {
    if (!formData.cep || formData.cep.replace(/\D/g, '').length !== 8) {
      alert('Por favor, informe um CEP válido');
      return;
    }

    setLoadingCep(true);
    try {
      const data = await consultarCep(formData.cep);
      if (data) {
        setFormData({
          ...formData,
          endereco: data.logradouro,
          cidade: data.localidade,
          estado: data.uf,
          regiao: data.uf,
        });
      }
    } catch (error) {
      alert('Erro ao consultar CEP. Verifique o CEP informado.');
    } finally {
      setLoadingCep(false);
    }
  };

  const handleCepChange = (value: string) => {
    const formatted = formatCep(value);
    setFormData({ ...formData, cep: formatted });

    if (formatted.replace(/\D/g, '').length === 8) {
      handleCepSearch();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const dataToSave = {
        ...formData,
        proximo_retorno: formData.proximo_retorno ? convertLocalToUTC(formData.proximo_retorno) : null,
        ultimo_contato: new Date().toISOString(),
      };

      let savedLeadId = lead?.id;

      if (lead) {
        const { error } = await supabase
          .from('leads')
          .update(dataToSave)
          .eq('id', lead.id);

        if (error) throw error;
      } else {
        const { data: insertedLead, error } = await supabase
          .from('leads')
          .insert([dataToSave])
          .select()
          .single();

        if (error) throw error;
        savedLeadId = insertedLead.id;
      }

      if (formData.proximo_retorno && savedLeadId) {
        const localDate = new Date(formData.proximo_retorno);
        localDate.setMinutes(localDate.getMinutes() - 1);
        const reminderDate = localDate.toISOString();

        const existingReminder = await supabase
          .from('reminders')
          .select('id')
          .eq('lead_id', savedLeadId)
          .eq('tipo', 'Retorno')
          .eq('lido', false)
          .maybeSingle();

        if (existingReminder.data) {
          await supabase
            .from('reminders')
            .update({
              titulo: `Retorno agendado: ${formData.nome_completo}`,
              descricao: `Retorno agendado para ${formData.nome_completo}. Telefone: ${formData.telefone}`,
              data_lembrete: reminderDate,
              prioridade: 'alta'
            })
            .eq('id', existingReminder.data.id);
        } else {
          await supabase
            .from('reminders')
            .insert([{
              lead_id: savedLeadId,
              tipo: 'Retorno',
              titulo: `Retorno agendado: ${formData.nome_completo}`,
              descricao: `Retorno agendado para ${formData.nome_completo}. Telefone: ${formData.telefone}`,
              data_lembrete: reminderDate,
              lido: false,
              prioridade: 'alta'
            }]);
        }
      }

      onSave();
    } catch (error) {
      console.error('Erro ao salvar lead:', error);
      alert('Erro ao salvar lead');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <h3 className="text-xl font-bold text-slate-900">
            {lead ? 'Editar Lead' : 'Novo Lead'}
          </h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Nome Completo *
              </label>
              <input
                type="text"
                required
                value={formData.nome_completo}
                onChange={(e) => setFormData({ ...formData, nome_completo: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Telefone *
              </label>
              <input
                type="tel"
                required
                value={formData.telefone}
                onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                E-mail
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                CEP
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={formData.cep}
                  onChange={(e) => handleCepChange(e.target.value)}
                  placeholder="00000-000"
                  maxLength={9}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
                {loadingCep && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-teal-500 border-t-transparent"></div>
                  </div>
                )}
                {!loadingCep && formData.cep.length > 0 && (
                  <button
                    type="button"
                    onClick={handleCepSearch}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-teal-600 hover:text-teal-700"
                  >
                    <Search className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Endereço
              </label>
              <input
                type="text"
                value={formData.endereco}
                onChange={(e) => setFormData({ ...formData, endereco: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Cidade
              </label>
              <input
                type="text"
                value={formData.cidade}
                onChange={(e) => setFormData({ ...formData, cidade: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Estado
              </label>
              <input
                type="text"
                value={formData.estado}
                onChange={(e) => setFormData({ ...formData, estado: e.target.value })}
                maxLength={2}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent uppercase"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Origem do Lead *
              </label>
              <select
                required
                value={formData.origem}
                onChange={(e) => setFormData({ ...formData, origem: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              >
                <option value="tráfego pago">Tráfego pago</option>
                <option value="Telein">Telein</option>
                <option value="indicação">Indicação</option>
                <option value="orgânico">Orgânico</option>
                <option value="Ully">Ully</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Tipo de Contratação *
              </label>
              <select
                required
                value={formData.tipo_contratacao}
                onChange={(e) => setFormData({ ...formData, tipo_contratacao: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              >
                <option value="Pessoa Física">Pessoa Física</option>
                <option value="MEI">MEI</option>
                <option value="CNPJ">CNPJ</option>
                <option value="Adesão">Adesão</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Operadora Atual
              </label>
              <input
                type="text"
                value={formData.operadora_atual}
                onChange={(e) => setFormData({ ...formData, operadora_atual: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Status *
              </label>
              <select
                required
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              >
                <option value="Novo">Novo</option>
                <option value="Contato iniciado">Contato iniciado</option>
                <option value="Em atendimento">Em atendimento</option>
                <option value="Cotando">Cotando</option>
                <option value="Proposta enviada">Proposta enviada</option>
                <option value="Fechado">Fechado</option>
                <option value="Perdido">Perdido</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Responsável *
              </label>
              <select
                required
                value={formData.responsavel}
                onChange={(e) => setFormData({ ...formData, responsavel: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              >
                <option value="Luiza">Luiza</option>
                <option value="Nick">Nick</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Próximo Retorno
              </label>
              <input
                type="datetime-local"
                value={formData.proximo_retorno}
                onChange={(e) => setFormData({ ...formData, proximo_retorno: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Observações
              </label>
              <textarea
                value={formData.observacoes}
                onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                rows={3}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="flex items-center justify-end space-x-3 mt-6 pt-6 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50"
            >
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
