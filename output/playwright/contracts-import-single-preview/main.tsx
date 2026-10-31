import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { DesignSystemProvider } from '../../../src/design-system';
import { ContractJsonImportDialog } from '../../../src/features/contracts/components/ContractJsonImportDialog';
import '../../../src/design-system/styles.css';

export function Preview() {
  const [open, setOpen] = useState(true);
  const [applied, setApplied] = useState(false);
  const theme = new URLSearchParams(window.location.search).get('theme') === 'dark' ? 'dark' : 'light';

  return (
    <DesignSystemProvider theme={theme} style={{ minHeight: '100vh' }}>
      <div style={{ padding: 32 }}>
        <h1>Gestão de contratos</h1>
        <p>Base sintética para revisar o diálogo de importação sem dados do CRM.</p>
        {applied ? <p role="status">JSON aplicado ao formulário local de prévia.</p> : null}
        <button type="button" onClick={() => { setOpen(true); setApplied(false); }} disabled={open}>Abrir importação de arquivo</button>
      </div>
      {open ? <ContractJsonImportDialog onApply={() => setApplied(true)} onClose={() => setOpen(false)} /> : null}
    </DesignSystemProvider>
  );
}

createRoot(document.getElementById('root')!).render(<Preview />);
