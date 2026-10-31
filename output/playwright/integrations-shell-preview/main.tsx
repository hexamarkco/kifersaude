import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import Layout from '../../../src/components/Layout';
import ConfigPageScreen from '../../../src/features/config/ConfigPageScreen';
import '../../../src/index.css';

createRoot(document.getElementById('root')!).render(
  <MemoryRouter initialEntries={['/painel/automacoes?tab=integrations']}>
    <Layout
      activeTab="automation-hub"
      onTabChange={() => undefined}
      unreadReminders={0}
      unreadInboxChats={0}
      hasActiveNotification={false}
      newLeadsCount={0}
    >
      <ConfigPageScreen area="automation" />
    </Layout>
  </MemoryRouter>,
);
