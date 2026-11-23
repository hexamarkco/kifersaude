import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useConfig } from '../../contexts/ConfigContext';
import { PageHeader, Tabs, type TabItem } from '../../design-system';
import { TeamProduction } from '../production';
import CommissionCalendarScreen from "./CommissionCalendarScreen";

type FinanceView = 'forecasts' | 'calendar' | 'production';

const headings = {
  forecasts: { title: 'Mais clareza sobre o que vem.', description: 'Comissões e bonificações previstas, sem perder os detalhes.' },
  calendar: { title: 'O financeiro no seu calendário.', description: 'Veja quando estão previstas as comissões e bonificações.' },
  production: { title: 'Produção que você acompanha.', description: 'Contratos, vidas e mensalidades por responsável.' },
};

export default function FinanceiroComissoesScreen() {
  const [view, setView] = useState<FinanceView>('forecasts');
  const navigate = useNavigate();
  const { role } = useAuth();
  const { getRoleModulePermission } = useConfig();
  const canViewProduction = getRoleModulePermission(role, 'dashboard').can_view;
  const canViewLeads = getRoleModulePermission(role, 'leads').can_view;
  const activeView = view === 'production' && !canViewProduction ? 'forecasts' : view;
  const tabs: TabItem<FinanceView>[] = [
    { id: 'forecasts', label: 'Previsões' },
    { id: 'calendar', label: 'Calendário' },
  ];
  if (canViewProduction) tabs.push({ id: 'production', label: 'Produção' });
  const header = (
    <PageHeader {...headings[activeView]}>
      <Tabs items={tabs} value={activeView} onChange={setView} ariaLabel="Visões do financeiro" />
    </PageHeader>
  );

  return activeView === 'production' ? (
    <div className="panel-page-shell space-y-5">
      {header}
      <TeamProduction onNavigateToLead={(id) => {
        if (canViewLeads) navigate({ pathname: '/painel/leads', search: new URLSearchParams({ busca: id }).toString() });
      }} />
    </div>
  ) : <CommissionCalendarScreen view={activeView} header={header} />;
}
