import { useState } from 'react';
import { Plus, Trash2, PaintBucket, GripVertical, Star } from 'lucide-react';
import { useConfig } from '../../contexts/ConfigContext';
import { configService } from '../../lib/configService';
import { getBadgeStyle } from '../../lib/colorUtils';
import { useConfirmationModal } from '../../hooks/useConfirmationModal';

export default function LeadStatusManager() {
  const { leadStatuses, refreshLeadStatuses } = useConfig();
  const [newStatus, setNewStatus] = useState({ nome: '', cor: '#3b82f6', ordem: leadStatuses.length + 1 });
  const [saving, setSaving] = useState(false);
  const { requestConfirmation, ConfirmationDialog } = useConfirmationModal();

  const handleCreate = async () => {
    if (!newStatus.nome.trim()) {
      alert('Informe o nome do status');
      return;
    }

    setSaving(true);
    const { error } = await configService.createLeadStatus({
      nome: newStatus.nome.trim(),
      cor: newStatus.cor,
      ordem: newStatus.ordem,
      ativo: true,
      padrao: leadStatuses.length === 0,
    });

    if (error) {
      alert('Erro ao criar status');
    } else {
      setNewStatus({ nome: '', cor: '#3b82f6', ordem: leadStatuses.length + 2 });
      await refreshLeadStatuses();
    }
    setSaving(false);
  };

  const handleUpdate = async (id: string, updates: Partial<{ nome: string; cor: string; ordem: number; ativo: boolean; padrao: boolean }>) => {
    const { error } = await configService.updateLeadStatus(id, updates);
    if (error) {
      alert('Erro ao atualizar status');
    } else {
      await refreshLeadStatuses();
    }
  };

  const handleDelete = async (id: string) => {
    const status = leadStatuses.find(s => s.id === id);
    if (!status) return;
    if (status.padrao) {
      alert('Não é possível remover o status padrão. Defina outro status como padrão antes de remover.');
      return;
    }

    const confirmed = await requestConfirmation({
      title: 'Excluir status',
      description: 'Deseja remover este status? Esta ação não pode ser desfeita.',
      confirmLabel: 'Excluir',
      cancelLabel: 'Cancelar',
      tone: 'danger',
    });
    if (!confirmed) return;

    const { error } = await configService.deleteLeadStatus(id);
    if (error) {
      alert('Erro ao remover status');
    } else {
      await refreshLeadStatuses();
    }
  };

  const handleSetDefault = async (id: string) => {
    const target = leadStatuses.find(s => s.id === id);
    if (!target) return;

    await Promise.all(
      leadStatuses.map(status => {
        if (status.id === id) {
          return configService.updateLeadStatus(status.id, { padrao: true });
        }
        if (status.padrao) {
          return configService.updateLeadStatus(status.id, { padrao: false });
        }
        return Promise.resolve({ error: null });
      })
    );

    await refreshLeadStatuses();
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Status dos Leads</h3>
          <p className="text-sm text-slate-600">Personalize as etapas do funil de leads e defina cores e ordens.</p>
        </div>
      </div>

      <div className="space-y-4">
        {leadStatuses.map((status) => (
          <div key={status.id} className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg p-4">
            <div className="flex items-center space-x-4">
              <GripVertical className="w-4 h-4 text-slate-400" />
              <div>
                <div className="flex items-center space-x-3">
                  <span
                    className="px-3 py-1 rounded-full text-sm font-medium border"
                    style={getBadgeStyle(status.cor, 1)}
                  >
                    {status.nome}
                  </span>
                  {status.padrao && (
                    <span className="inline-flex items-center space-x-1 text-xs text-amber-600 bg-amber-100 border border-amber-200 rounded-full px-2 py-0.5">
                      <Star className="w-3 h-3" />
                      <span>Padrão</span>
                    </span>
                  )}
                </div>
                <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
                  <label className="flex flex-col text-xs text-slate-600">
                    Nome
                    <input
                      type="text"
                      value={status.nome}
                      onChange={(e) => handleUpdate(status.id, { nome: e.target.value })}
                      className="mt-1 px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </label>
                  <label className="flex flex-col text-xs text-slate-600">
                    Cor
                    <div className="flex items-center space-x-2 mt-1">
                      <input
                        type="color"
                        value={status.cor}
                        onChange={(e) => handleUpdate(status.id, { cor: e.target.value })}
                        className="h-10 w-16 border border-slate-300 rounded"
                      />
                      <span className="text-xs text-slate-500 flex items-center space-x-1">
                        <PaintBucket className="w-4 h-4 text-slate-400" />
                        <span>{status.cor}</span>
                      </span>
                    </div>
                  </label>
                  <label className="flex flex-col text-xs text-slate-600">
                    Ordem
                    <input
                      type="number"
                      value={status.ordem}
                      onChange={(e) => handleUpdate(status.id, { ordem: parseInt(e.target.value) || 0 })}
                      className="mt-1 px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </label>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <label className="inline-flex items-center space-x-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={status.ativo}
                  onChange={(e) => handleUpdate(status.id, { ativo: e.target.checked })}
                  className="w-4 h-4 text-teal-600 rounded border-slate-300 focus:ring-teal-500"
                />
                <span>Ativo</span>
              </label>
              <button
                onClick={() => handleSetDefault(status.id)}
                className={`px-3 py-1 rounded-lg text-sm font-medium border transition-colors ${
                  status.padrao
                    ? 'border-amber-300 text-amber-700 bg-amber-100'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                Definir padrão
              </button>
              <button
                onClick={() => handleDelete(status.id)}
                className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                title="Remover status"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 pt-6 border-t border-slate-200">
        <h4 className="text-sm font-semibold text-slate-900 mb-3">Adicionar novo status</h4>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1">Nome</label>
            <input
              type="text"
              value={newStatus.nome}
              onChange={(e) => setNewStatus(prev => ({ ...prev, nome: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500"
              placeholder="Ex: Em negociação"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Cor</label>
            <input
              type="color"
              value={newStatus.cor}
              onChange={(e) => setNewStatus(prev => ({ ...prev, cor: e.target.value }))}
              className="h-10 w-full border border-slate-300 rounded"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Ordem</label>
            <input
              type="number"
              value={newStatus.ordem}
              onChange={(e) => setNewStatus(prev => ({ ...prev, ordem: parseInt(e.target.value) || 0 }))}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500"
            />
          </div>
        </div>
        <div className="mt-4">
          <button
            onClick={handleCreate}
            disabled={saving}
            className="inline-flex items-center space-x-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            <span>{saving ? 'Salvando...' : 'Adicionar status'}</span>
          </button>
        </div>
      </div>
      {ConfirmationDialog}
    </div>
  );
}
