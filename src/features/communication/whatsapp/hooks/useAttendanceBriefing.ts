import { useEffect, useState } from 'react';
import { loadAttendanceBriefing } from '../data/attendanceRepository';
import type { AttendanceBriefing } from '../domain/attendanceBriefing';

export function useAttendanceBriefing(chatId: string, leadId: string) {
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<{ chatId: string; leadId: string; data: AttendanceBriefing | null; error: string | null; loading: boolean }>(
    { chatId, leadId, data: null, error: null, loading: true });
  useEffect(() => {
    let cancelled = false;
    setResult({ chatId, leadId, data: null, error: null, loading: true });
    loadAttendanceBriefing(chatId, leadId).then((data) => {
      if (!cancelled) setResult({ chatId, leadId, data, error: null, loading: false });
    }).catch(() => {
      if (!cancelled) setResult({ chatId, leadId, data: null, error: 'Não foi possível carregar o resumo do atendimento.', loading: false });
    });
    return () => { cancelled = true; };
  }, [chatId, leadId, revision]);
  const current = result.chatId === chatId && result.leadId === leadId ? result : { data: null, error: null, loading: true };
  return { ...current, refresh: () => setRevision((value) => value + 1) };
}
