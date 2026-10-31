import { createRoot } from 'react-dom/client';
import ContractDetails from '../../../src/components/ContractDetails';
import '../../../src/index.css';

const contract = {
  id: 'demo-contract-413780',
  codigo_contrato: '413780',
  status: 'Ativo',
  modalidade: 'PME',
  operadora: 'Assim Saúde',
  produto_plano: 'Clássico',
  abrangencia: 'Nacional',
  acomodacao: 'Apartamento',
  data_inicio: '2026-10-01',
  data_renovacao: '2027-10-01',
  mensalidade_total: 441.53,
  comissao_prevista: 1236.28,
  responsavel: 'Equipe de demonstração',
  vidas: 3,
  created_at: '2026-10-29T12:00:00.000Z',
  updated_at: '2026-10-29T12:00:00.000Z',
};

createRoot(document.getElementById('root')!).render(
  <div className="painel-theme kifer-ds min-h-screen bg-[var(--bg-canvas)] p-4 md:p-6 xl:p-8">
    <ContractDetails
      presentation="page"
      contract={contract}
      onClose={() => { window.location.hash = 'back'; }}
      onUpdate={() => undefined}
      onEdit={() => { window.location.hash = 'edit'; }}
      onDelete={() => Promise.resolve()}
    />
  </div>,
);
