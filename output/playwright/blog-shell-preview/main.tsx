import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import Layout from '../../../src/components/Layout';
import BlogTabScreen from '../../../src/features/blog/BlogTabScreen';
import ToastViewport from '../../../src/components/ui/ToastViewport';
import '../../../src/index.css';

createRoot(document.getElementById('root')!).render(
  <MemoryRouter initialEntries={['/painel/blog']}>
    <Layout activeTab="blog" onTabChange={() => undefined} unreadReminders={0} unreadInboxChats={0} hasActiveNotification={false} newLeadsCount={0}>
      <BlogTabScreen />
      <ToastViewport />
    </Layout>
  </MemoryRouter>,
);
