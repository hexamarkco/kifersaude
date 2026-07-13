import { useState } from 'react';
import { supabase, ContractValueAdjustment } from '../lib/supabase';
import { formatCurrencyFromNumber, formatCurrencyInput, parseFormattedNumber } from '../lib/inputFormatters';
import { DollarSign } from 'lucide-react';
import ModalShell from './ui/ModalShell';
import { ActionSurface, Alert, Button, Field, Input, Textarea } from '../design-system';

type ValueAdjustmentFormProps = {
  contractId: string;
  adjustment?: ContractValueAdjustment;
  responsavel: string;
  onClose: () => void;
  onSave: () => void;
};

export default function ValueAdjustmentForm({
  contractId,
  adjustment,
  responsavel,
  onClose,
  onSave
}: ValueAdjustmentFormProps) {
  const [formData, setFormData] = useState({
    tipo: adjustment?.tipo || 'acrescimo',
    valor: formatCurrencyFromNumber(adjustment?.valor),
    motivo: adjustment?.motivo || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.motivo.trim()) {
      setError('O motivo é obrigatório');
      return;
    }

    if (!formData.valor || parseFormattedNumber(formData.valor) <= 0) {
      setError('O valor deve ser maior que zero');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const dataToSave = {
        contract_id: contractId,
        tipo: formData.tipo as 'desconto' | 'acrescimo',
        valor: parseFormattedNumber(formData.valor),
        motivo: formData.motivo.trim(),
        created_by: responsavel,
      };

      if (adjustment) {
        const { error } = await supabase
          .from('contract_value_adjustments')
          .update(dataToSave)
          .eq('id', adjustment.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('contract_value_adjustments')
          .insert([dataToSave]);

        if (error) throw error;
      }

      onSave();
    } catch (error) {
      console.error('Erro ao salvar ajuste:', error);
      setError('Erro ao salvar ajuste. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell
      isOpen
      onClose={onClose}
      title={adjustment ? 'Editar Ajuste' : 'Adicionar Ajuste de Valor'}
      size="sm"
      panelClassName="max-w-md"
      bodyClassName="p-0"
    >
        <form onSubmit={handleSubmit} className="max-h-[70vh] overflow-y-auto p-6">
          <h3 className="mb-4 flex items-center text-lg font-bold text-[var(--text-primary)]">
            <DollarSign className="mr-2 h-5 w-5" />
            {adjustment ? 'Editar Ajuste' : 'Adicionar Ajuste de Valor'}
          </h3>
          {error && (
            <Alert tone="danger" className="mb-4" role="alert">
              {error}
            </Alert>
          )}

          <div className="space-y-4">
            <Field label="Tipo de Ajuste *">
              <div className="grid grid-cols-2 gap-3">
                <ActionSurface
                  type="button"
                  onClick={() => setFormData({ ...formData, tipo: 'acrescimo' })}
                  variant={formData.tipo === 'acrescimo' ? 'success' : 'muted'}
                  padding="sm"
                  className="w-full cursor-pointer text-left transition-colors hover:border-[var(--border-strong)]"
                  aria-pressed={formData.tipo === 'acrescimo'}
                >
                  <div className="font-semibold">Acréscimo</div>
                  <div className="text-xs mt-1">Adicionar valor</div>
                </ActionSurface>
                <ActionSurface
                  type="button"
                  onClick={() => setFormData({ ...formData, tipo: 'desconto' })}
                  variant={formData.tipo === 'desconto' ? 'danger' : 'muted'}
                  padding="sm"
                  className="w-full cursor-pointer text-left transition-colors hover:border-[var(--border-strong)]"
                  aria-pressed={formData.tipo === 'desconto'}
                >
                  <div className="font-semibold">Desconto</div>
                  <div className="text-xs mt-1">Reduzir valor</div>
                </ActionSurface>
              </div>
            </Field>

            <Field label="Valor (R$) *">
              <Input
                type="text"
                required
                value={formData.valor}
                onChange={(e) => setFormData({ ...formData, valor: formatCurrencyInput(e.target.value) })}
                placeholder="0,00"
                inputMode="numeric"
              />
            </Field>

            <Field
              label="Motivo *"
              description="Este motivo será registrado no histórico do contrato"
            >
              <Textarea
                required
                value={formData.motivo}
                onChange={(e) => setFormData({ ...formData, motivo: e.target.value })}
                rows={3}
                placeholder="Descreva o motivo deste ajuste..."
                className="resize-none"
              />
            </Field>
          </div>

          <div className="mt-6 flex flex-col-reverse gap-3 border-t border-[var(--border-subtle)] pt-6 sm:flex-row sm:items-center sm:justify-end">
            <Button
              type="button"
              onClick={onClose}
              variant="ghost"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              loading={saving}
            >
              {saving ? 'Salvando...' : adjustment ? 'Atualizar' : 'Adicionar'}
            </Button>
          </div>
        </form>
    </ModalShell>
  );
}
