import { useRef, useState } from 'react';
import { providerOperationsRepository, ProviderOperationError, type ProviderOperationResult } from '../data/providerOperationsRepository';
import { zapiOperations, type ZapiJson, type ZapiOperation, type ZapiOperationInput } from '../domain/zapiOperationContract.generated';

export function useProviderOperations(revision: number) {
  const [operation, setOperation] = useState<ZapiOperation>('contacts/get-contacts');
  const [input, setInput] = useState<Record<string, ZapiJson>>({ page: 1, pageSize: 100 });
  const [pending, setPending] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ProviderOperationResult | null>(null);
  const request = useRef({ id: crypto.randomUUID(), locked: false });

  const reset = () => {
    request.current.id = crypto.randomUUID();
    setResult(null); setError(null); setUncertain(false);
  };
  const selectOperation = (next: ZapiOperation) => {
    if (request.current.locked || uncertain) return;
    setOperation(next);
    const props = zapiOperations[next].input.properties as Readonly<Record<string, { type: string }>>;
    setInput(Object.fromEntries(Object.entries(props).filter(([key]) => key === 'page' || key === 'pageSize')
      .map(([key]) => [key, key === 'page' ? 1 : 100])));
    reset();
  };
  const changeInput = (next: Record<string, ZapiJson>) => {
    if (request.current.locked || uncertain) return;
    setInput(next); reset();
  };
  const execute = async () => {
    if (request.current.locked) return;
    request.current.locked = true; setPending(true); setError(null);
    try {
      const response = await providerOperationsRepository.execute(operation, input as ZapiOperationInput<typeof operation>, {
        requestId: request.current.id, revision,
      });
      setResult(response); setUncertain(false);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Não foi possível concluir a operação.');
      setUncertain(failure instanceof ProviderOperationError && failure.ambiguous);
    } finally {
      request.current.locked = false; setPending(false);
    }
  };
  return { operation, input, pending, uncertain, error, result, selectOperation, changeInput, execute };
}
