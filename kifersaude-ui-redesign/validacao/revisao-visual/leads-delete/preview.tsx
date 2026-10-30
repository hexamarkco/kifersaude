import { useState } from 'react';
import { createRoot } from 'react-dom/client';

import '../../../../src/design-system/styles.css';
import { ConfirmDialog, DesignSystemProvider } from '../../../../src/design-system';
import { LeadDeletionSummary } from '../../../../src/features/leads/components/LeadDeletionSummary';

const referenceDesktop = new URL('../../../references/desktop/page--leads-listagem.png', import.meta.url).href;
const referenceMobile = new URL('../../../references/mobile/page--leads-listagem.png', import.meta.url).href;
const theme = new URLSearchParams(window.location.search).get('theme') === 'dark' ? 'theme-dark' : 'theme-light';

export function LeadDeletionPreview() {
  const [open, setOpen] = useState(true);

  return (
    <DesignSystemProvider theme={theme === 'theme-dark' ? 'dark' : 'light'} className="kifer-panel-theme lead-delete-preview">
      <picture className="lead-delete-preview-background" aria-hidden="true">
        <source media="(max-width: 768px)" srcSet={referenceMobile} />
        <img src={referenceDesktop} alt="" />
      </picture>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Excluir lead"
        description="Confira o registro e o impacto antes de excluir."
        confirmLabel="Excluir"
        cancelLabel="Cancelar"
        destructive
        onConfirm={() => setOpen(false)}
      >
        <LeadDeletionSummary leadName="Contato de demonstração" />
      </ConfirmDialog>
      <style>{`
        html, body, #root { width: 100%; min-width: 0; min-height: 100%; margin: 0; }
        body { overflow: hidden; }
        .lead-delete-preview { position: relative; min-height: 100dvh; overflow: hidden; }
        .lead-delete-preview-background, .lead-delete-preview-background img { position: absolute; inset: 0; width: 100%; height: 100%; }
        .lead-delete-preview-background img { object-fit: cover; object-position: top center; }
      `}</style>
    </DesignSystemProvider>
  );
}

createRoot(document.getElementById('root')!).render(<LeadDeletionPreview />);
