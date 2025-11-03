import { useState } from 'react';
import { Plus, Trash2, Check, X } from 'lucide-react';
import { useConfig } from '../../contexts/ConfigContext';
import { configService } from '../../lib/configService';

export default function LeadOriginsManager() {
  const { leadOrigins, refreshLeadOrigins } = useConfig();
  const [newOrigin, setNewOrigin] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    if (!newOrigin.trim()) {
      alert('Informe o nome da origem');
      return;
    }

    setSaving(true);
    const { error } = await configService.createLeadOrigem({ nome: newOrigin.trim(), ativo: true });
    if (error) {
      alert('Erro ao adicionar origem');
    } else {
      setNewOrigin('');
      await refreshLeadOrigins();
    }
    setSaving(false);
  };

  const handleToggle = async (id: string, ativo: boolean) => {
    const { error } = await configService.updateLeadOrigem(id, { ativo });
    if (error) {
      alert('Erro ao atualizar origem');
    } else {
      await refreshLeadOrigins();
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja remover esta origem?')) return;
    const { error } = await configService.deleteLeadOrigem(id);
    if (error) {
      alert('Erro ao remover origem');
    } else {
      await refreshLeadOrigins();
    }
  };

  const startEditing = (id: string, nome: string) => {
    setEditingId(id);
    setEditingName(nome);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditingName('');
  };

  const confirmEditing = async () => {
    if (!editingId) return;
    if (!editingName.trim()) {
      alert('Informe o nome da origem');
      return;
    }

    const { error } = await configService.updateLeadOrigem(editingId, { nome: editingName.trim() });
    if (error) {
      alert('Erro ao atualizar origem');
    } else {
      await refreshLeadOrigins();
      cancelEditing();
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Origens de Leads</h3>
          <p className="text-sm text-slate-600">Gerencie todos os canais de entrada de leads.</p>
        </div>
      </div>

      <div className="space-y-3">
        {leadOrigins.map(origin => (
          <div key={origin.id} className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg px-4 py-3">
            <div className="flex-1">
              {editingId === origin.id ? (
                <input
                  type="text"
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                />
              ) : (
                <p className="text-sm font-medium text-slate-900">{origin.nome}</p>
              )}
              <p className="text-xs text-slate-500 mt-1">{origin.ativo ? 'Ativo' : 'Inativo'}</p>
            </div>
            <div className="flex items-center space-x-2">
              <label className="inline-flex items-center space-x-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={origin.ativo}
                  onChange={(e) => handleToggle(origin.id, e.target.checked)}
                  className="w-4 h-4 text-teal-600 rounded border-slate-300 focus:ring-teal-500"
                />
                <span>Ativo</span>
              </label>
              {editingId === origin.id ? (
                <div className="flex items-center space-x-2">
                  <button
                    onClick={confirmEditing}
                    className="p-2 text-green-600 hover:bg-green-50 rounded-lg"
                    title="Salvar"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                  <button
                    onClick={cancelEditing}
                    className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg"
                    title="Cancelar"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => startEditing(origin.id, origin.nome)}
                    className="px-3 py-1 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-100"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => handleDelete(origin.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                    title="Remover"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 pt-6 border-t border-slate-200">
        <h4 className="text-sm font-semibold text-slate-900 mb-3">Adicionar nova origem</h4>
        <div className="flex flex-col md:flex-row md:items-center md:space-x-3 space-y-3 md:space-y-0">
          <input
            type="text"
            value={newOrigin}
            onChange={(e) => setNewOrigin(e.target.value)}
            className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500"
            placeholder="Ex: Indicação"
          />
          <button
            onClick={handleCreate}
            disabled={saving}
            className="inline-flex items-center space-x-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            <span>{saving ? 'Salvando...' : 'Adicionar origem'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
