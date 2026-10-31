import { createRoot } from 'react-dom/client';
import { Card, CardIcon, Heading, InfoTooltip } from '../../../src/design-system';
import '../../../src/index.css';
import { ShieldCheck } from 'lucide-react';

function TitleRowPreview() {
  return (
    <div className="painel-theme kifer-ds comm-terracotta theme-dark p-4" style={{ width: 216 }}>
      <Card padding="md" className="kds-automation-setting-card" style={{ width: 184 }}>
        <div className="kds-automation-setting-heading">
          <CardIcon className="kds-automation-setting-icon"><ShieldCheck className="h-5 w-5" aria-hidden="true" /></CardIcon>
          <div className="kds-card-title-row min-w-0 flex-nowrap">
            <Heading level={4} className="kds-card-title min-w-0">Envio automático</Heading>
            <InfoTooltip content="Pausa ou libera o processamento dos fluxos ativos." label="Informações sobre o processamento dos fluxos" className="shrink-0" />
          </div>
        </div>
      </Card>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<TitleRowPreview />);
