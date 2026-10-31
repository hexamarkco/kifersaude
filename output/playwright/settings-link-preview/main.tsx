import React from 'react';
import { createRoot } from 'react-dom/client';
import { Surface, Text } from '../../../src/design-system';
import { SettingsCatalogLink } from '../../../src/features/config/general/components/SettingsCatalogLink';
import '../../../src/design-system/styles.css';

export function App() {
  return (
    <main className="painel-theme kifer-ds theme-light" style={{ minHeight: '100vh', padding: '24px', background: 'var(--bg-canvas)', color: 'var(--text-primary)' }}>
      <Surface padding="md" className="max-w-md">
        <h1 style={{ fontSize: '16px', fontWeight: 600 }}>Estrutura e parametrização</h1>
        <Text className="mt-1 text-sm text-[var(--text-secondary)]">Acesse os cadastros que alimentam os formulários e a operação do CRM.</Text>
        <div className="mt-4 divide-y divide-[var(--border-subtle)]">
          <SettingsCatalogLink title="Perfis e acessos" description="Permissões por área do CRM" ariaLabel="Abrir perfis e acessos" onClick={() => undefined} />
          <SettingsCatalogLink title="Etapas do funil" description="Nome, cor e etapa inicial dos leads" count={6} ariaLabel="Abrir etapas do funil" onClick={() => undefined} />
        </div>
      </Surface>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
