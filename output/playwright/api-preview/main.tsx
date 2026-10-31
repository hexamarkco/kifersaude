import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import Layout from '../../../src/components/Layout';
import ApiDocsScreen from '../../../src/features/config/integrations/api-docs/ApiDocsScreen';
import ToastViewport from '../../../src/components/ui/ToastViewport';
import '../../../src/index.css';
createRoot(document.getElementById('root')!).render(
  <MemoryRouter initialEntries={['/painel/api']}>
    <Layout activeTab="api" onTabChange={() => undefined} unreadReminders={0} unreadInboxChats={0} hasActiveNotification={false} newLeadsCount={0}>
      <ApiDocsScreen />
      <ToastViewport />
    </Layout>
  </MemoryRouter>,
);
