import { useOutletContext } from 'react-router-dom';
import LeadsManager from '../../components/LeadsManager';
import type { Lead } from '../../lib/supabase';
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
  const { handleTabChange, leadStatusFilter, leadIdFilter, setLeadToConvert } = useOutletContext<OutletContext>();
  
  return (
    <LeadsManager
      onConvertToContract={(lead) => {
        setLeadToConvert(lead);
        handleTabChange('contracts');
      }}
      initialStatusFilter={leadStatusFilter}
      initialLeadIdFilter={leadIdFilter}
    />
  );
}
