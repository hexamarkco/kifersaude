import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import Layout from '../../../src/components/Layout';
import ContractsManager from '../../../src/features/contracts/ContractsManagerScreen';
import '../../../src/index.css';

const requestedTheme = new URLSearchParams(window.location.search).get('theme');
if (requestedTheme === 'light' || requestedTheme === 'dark') {
  window.localStorage.setItem('painel.theme.v2', requestedTheme);
}

function ContractsPreview() {
  const [activeTab, setActiveTab] = useState('contracts');

  return (
    <Layout
      activeTab={activeTab}
      onTabChange={setActiveTab}
      unreadReminders={0}
      unreadInboxChats={0}
      newLeadsCount={0}
    >
      <ContractsManager />
    </Layout>
  );
}

createRoot(document.getElementById('root')!).render(
  <BrowserRouter>
    <ContractsPreview />
  </BrowserRouter>,
);
