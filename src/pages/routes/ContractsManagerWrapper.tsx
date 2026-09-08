import { useOutletContext } from 'react-router-dom';
import { ContractsManagerScreen as ContractsManager } from '../../features/contracts';
import type { Lead } from '../../features/leads';
import type { TabNavigationOptions } from '../../types/navigation';

interface OutletContext {
  activeTab: string;
  handleTabChange: (tab: string, options?: TabNavigationOptions) => void;
  contractOperadoraFilter?: string;
  leadToConvert: Lead | null;
  onConvertComplete: () => void;
  setLeadToConvert: (lead: Lead | null) => void;
}

export default function ContractsManagerWrapper() {
  const { leadToConvert, onConvertComplete, contractOperadoraFilter } = useOutletContext<OutletContext>();
  
  return (
    <ContractsManager
      leadToConvert={leadToConvert}
      onConvertComplete={onConvertComplete}
      initialOperadoraFilter={contractOperadoraFilter}
    />
  );
}
