import { useOutletContext } from 'react-router-dom';
import Dashboard from '../../components/Dashboard';
import type { TabNavigationOptions } from '../../types/navigation';

interface OutletContext {
  activeTab: string;
  handleTabChange: (tab: string, options?: TabNavigationOptions) => void;
}

export default function DashboardWrapper() {
  const { handleTabChange } = useOutletContext<OutletContext>();
  return <Dashboard onNavigateToTab={handleTabChange} />;
}
