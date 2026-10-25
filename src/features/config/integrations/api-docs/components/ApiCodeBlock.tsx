import { Text } from '../../../../../design-system';
import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { Button } from '../../../../../design-system';

export function ApiCodeBlock({ title, value }: { title: string; value: string }) {
  const [message, setMessage] = useState('');
  const copy = async () => {
    try { await navigator.clipboard.writeText(value); setMessage('Copiado'); }
    catch { setMessage('Selecione o texto abaixo para copiar.'); }
  };
  return (
    <div className="kds-api-code">
      <div className="kds-api-code-header">
        <span>{title}</span>
        <Button variant="ghost" size="sm" onClick={() => void copy()} aria-label={`Copiar ${title}`}>
          {message === 'Copiado' ? <Check size={14} /> : <Copy size={14} />} Copiar
        </Button>
      </div>
      {message && <Text className="kds-api-copy-message" role="status">{message}</Text>}
      <pre tabIndex={0} aria-label={title}>{value}</pre>
    </div>
  );
}
