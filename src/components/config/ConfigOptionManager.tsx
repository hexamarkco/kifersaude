import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useConfig } from '../../contexts/ConfigContext';
import { configService, ConfigCategory } from '../../lib/configService';

type ConfigOptionManagerProps = {
  category: ConfigCategory;
  title: string;
  description?: string;
  placeholder?: string;
};

export default function ConfigOptionManager({ category, title, description, placeholder }: ConfigOptionManagerProps) {
  const { options, refreshCategory } = useConfig();
  const [newLabel, setNewLabel] = useState('');
  const [newValue, setNewValue] = useState('');
  const [saving, setSaving] = useState(false);

  const items = options[category] || [];

  const handleCreate = async () => {
    if (!newLabel.trim()) {
      alert('Informe o nome da opção');
      return;
    }

    setSaving(true);
    const { error } = await configService.createConfigOption(category, {
      label: newLabel.trim(),
      value: newValue.trim() || newLabel.trim(),
      ordem: items.length + 1,
      ativo: true,
    });

    if (error) {
      alert('Erro ao adicionar opção');
    } else {
      setNewLabel('');
      setNewValue('');
      await refreshCategory(category);
    }
    setSaving(false);
  };

  const handleUpdate = async (id: string, updates: Record<string, any>) => {
    const { error } = await configService.updateConfigOption(id, updates);
    if (error) {
      alert('Erro ao atualizar opção');
    } else {
      await refreshCategory(category);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja remover esta opção?')) return;
    const { error } = await configService.deleteConfigOption(id);
    if (error) {
      alert('Erro ao remover opção');
    } else {
      await refreshCategory(category);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
          {description && <p className="text-sm text-slate-600">{description}</p>}
        </div>
      </div>

      <div className="space-y-3">
        {items.map(item => (
          <div key={item.id} className="flex flex-col md:flex-row md:items-center md:space-x-3 space-y-3 md:space-y-0 bg-slate-50 border border-slate-200 rounded-lg px-4 py-3">
            <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-3">
              <label className="flex flex-col text-xs text-slate-600">
                Rótulo
                <input
                  type="text"
                  value={item.label}
                  onChange={(e) => handleUpdate(item.id, { label: e.target.value })}
                  className="mt-1 px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                />
              </label>
              <label className="flex flex-col text-xs text-slate-600">
                Valor salvo
                <input
                  type="text"
                  value={item.value}
                  onChange={(e) => handleUpdate(item.id, { value: e.target.value })}
                  className="mt-1 px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                />
              </label>
              <label className="flex flex-col text-xs text-slate-600">
                Ordem
                <input
                  type="number"
                  value={item.ordem}
                  onChange={(e) => handleUpdate(item.id, { ordem: parseInt(e.target.value) || 0 })}
                  className="mt-1 px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                />
              </label>
            </div>
            <div className="flex items-center space-x-3">
              <label className="inline-flex items-center space-x-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={item.ativo}
                  onChange={(e) => handleUpdate(item.id, { ativo: e.target.checked })}
                  className="w-4 h-4 text-teal-600 rounded border-slate-300 focus:ring-teal-500"
                />
                <span>Ativo</span>
              </label>
              <button
                onClick={() => handleDelete(item.id)}
                className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                title="Remover opção"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}

        {items.length === 0 && (
          <div className="text-sm text-slate-600 bg-slate-50 border border-dashed border-slate-300 rounded-lg p-4 text-center">
            Nenhuma opção cadastrada ainda.
          </div>
        )}
      </div>

      <div className="mt-6 pt-6 border-t border-slate-200">
        <h4 className="text-sm font-semibold text-slate-900 mb-3">Adicionar nova opção</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-1">
            <label className="block text-xs font-medium text-slate-600 mb-1">Rótulo</label>
            <input
              type="text"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500"
              placeholder={placeholder || 'Ex: Valor visível para o usuário'}
            />
          </div>
          <div className="md:col-span-1">
            <label className="block text-xs font-medium text-slate-600 mb-1">Valor salvo (opcional)</label>
            <input
              type="text"
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500"
              placeholder="Ex: valor_armazenado"
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
            <span>{saving ? 'Salvando...' : 'Adicionar opção'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
