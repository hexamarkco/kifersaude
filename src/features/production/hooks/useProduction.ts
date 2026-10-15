import { useCallback, useEffect, useRef, useState } from 'react';
import { activateProduction, loadProductionOperators, loadProductionReport } from '../data/productionRepository';
import { productionRange, type ProductionOperator, type ProductionReport } from '../domain/types';

export function useProductionOperators() {
  const [operators, setOperators] = useState<ProductionOperator[]>([]);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let current = true;
    loadProductionOperators().then((data) => { if (current) setOperators(data); }).catch(() => { if (current) setError('Não foi possível carregar os atendentes.'); });
    return () => { current = false; };
  }, []);
  return { operators, error };
}

export function useProduction() {
  const [range, setRange] = useState(() => productionRange(1));
  const [operator, setOperator] = useState('');
  const [offset, setOffset] = useState(0);
  const [report, setReport] = useState<ProductionReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const request = useRef(0);
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(range.start) && /^\d{4}-\d{2}-\d{2}$/.test(range.end) && range.start <= range.end;
  const reload = useCallback(async () => {
    const id = ++request.current;
    setReport(null); setError(null);
    if (!valid) { setError('Informe um intervalo válido.'); setLoading(false); return; }
    setLoading(true);
    try {
      const data = await loadProductionReport(range.start, range.end, operator, offset);
      if (id === request.current) setReport(data);
    } catch { if (id === request.current) setError('Cobertura indisponível: não foi possível consultar a produção. Os dados não representam zero.'); }
    finally { if (id === request.current) setLoading(false); }
  }, [range.start, range.end, operator, offset, valid]);
  useEffect(() => { void reload(); return () => { request.current += 1; }; }, [reload]);
  const activate = async () => {
    try { await activateProduction(); await reload(); }
    catch { setError('Não foi possível ativar a medição.'); }
  };
  return { range, setRange: (next: typeof range) => { setOffset(0); setRange(next); }, operator,
    setOperator: (value: string) => { setOffset(0); setOperator(value); }, offset, setOffset, report, error, loading, reload, activate };
}
