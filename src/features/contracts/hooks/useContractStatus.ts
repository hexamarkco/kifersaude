import { useRef, useState } from 'react';
import { toast } from '../../../lib/toast';
import { updateContractStatus } from '../data/contractsRepository';
import type { Contract } from '../domain/types';

type StatusUpdate = Pick<Contract, 'id' | 'status' | 'updated_at'>;

export function useContractStatus(onSaved: (update: StatusUpdate) => void) {
  const pending = useRef(new Set<string>());
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());

  const changeStatus = async (contract: Contract, status: string) => {
    if (pending.current.has(contract.id) || contract.status === status) return;
    pending.current.add(contract.id);
    setSavingIds(new Set(pending.current));
    try {
      const updated = await updateContractStatus(contract.id, status);
      onSaved({ ...updated, updated_at: updated.updated_at ?? contract.updated_at });
      toast.success('Status do contrato atualizado.');
    } catch (error) {
      console.error('Erro ao atualizar status do contrato:', error);
      toast.error('Não foi possível alterar o status. Tente novamente.');
    } finally {
      pending.current.delete(contract.id);
      setSavingIds(new Set(pending.current));
    }
  };

  return { changeStatus, savingIds };
}
