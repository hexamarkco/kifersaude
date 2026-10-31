import { createRoot } from 'react-dom/client';
import ContractForm from '../../../src/components/ContractForm';
import '../../../src/index.css';

createRoot(document.getElementById('root')!).render(
  <div className="painel-theme kifer-ds min-h-screen bg-[var(--bg-canvas)] px-4 py-5 sm:px-8">
    <ContractForm presentation="page" onClose={() => undefined} />
  </div>,
);
