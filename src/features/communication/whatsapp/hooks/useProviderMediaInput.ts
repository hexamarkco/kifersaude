import { useEffect, useRef, useState } from 'react';

export function useProviderMediaInput(onChange: (value: string) => void) {
  const reader = useRef<FileReader | null>(null);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => () => { reader.current?.abort(); }, []);

  const select = (file: File | undefined) => {
    if (!file) return;
    if (!file.size || file.size > 32 * 1024 * 1024) { setError('Escolha um arquivo de até 32 MB.'); return; }
    reader.current?.abort();
    const current = new FileReader();
    reader.current = current; setLoading(true); setError(null);
    current.onload = () => {
      if (reader.current !== current) return;
      setLoading(false);
      if (typeof current.result !== 'string') { setError('Não foi possível preparar o arquivo.'); return; }
      setName(file.name); onChange(current.result);
    };
    current.onerror = () => { setLoading(false); setError('Não foi possível ler o arquivo. Escolha-o novamente.'); };
    current.readAsDataURL(file);
  };
  return { select, name, error, loading };
}
