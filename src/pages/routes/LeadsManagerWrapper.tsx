import { useOutletContext } from 'react-router-dom';
import { useState } from 'react';
import ContractForm from '../../components/ContractForm';
import { LeadsManagerScreen as LeadsManager, type Lead } from '../../features/leads';
import type { TabNavigationOptions } from '../../types/navigation';

interface OutletContext {
  activeTab: string;
  handleTabChange: (tab: string, options?: TabNavigationOptions) => void;
  leadStatusFilter?: string[];
  leadIdFilter?: string | undefined;
  leadToConvert: Lead | null;
  onConvertComplete: () => void;
  setLeadToConvert: (lead: Lead | null) => void;
}

export default function LeadsManagerWrapper() {
  const { handleTabChange, leadStatusFilter, leadIdFilter } = useOutletContext<OutletContext>();
  const [conversionLead, setConversionLead] = useState<Lead | null>(null);
  
  return (
    <>
      <LeadsManager onConvertToContract={setConversionLead} initialStatusFilter={leadStatusFilter} initialLeadIdFilter={leadIdFilter} />
      {conversionLead && <ContractForm key={conversionLead.id} contract={null} leadToConvert={conversionLead} onClose={() => setConversionLead(null)} onSave={() => { setConversionLead(null); handleTabChange('contracts'); }} />}
    </>
  );
}
