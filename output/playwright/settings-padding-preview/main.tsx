import { createRoot } from 'react-dom/client';
import { Heading, Surface, Text } from '../../../src/design-system';
import { SettingsCatalogLink } from '../../../src/features/config/general/components/SettingsCatalogLink';
import '../../../src/index.css';

createRoot(document.getElementById('root')!).render(
  <main className="painel-theme kifer-ds" style={{ backgroundColor: 'var(--bg-canvas)', color: 'var(--text-primary)', minHeight: '100vh', padding: 'var(--space-4)', fontFamily: 'var(--font-sans)' }}>
    <Surface padding="md" style={{ maxWidth: 520, margin: '0 auto' }}>
      <Heading level={3} className="text-base font-semibold">Estrutura e parametrização</Heading>
      <Text className="mt-1 text-sm text-[var(--text-secondary)]">Acesse os cadastros que alimentam os formulários e a operação do CRM.</Text>
      <div className="mt-4 divide-y divide-[var(--border-subtle)]">
        <SettingsCatalogLink title="Perfis e acessos" description="Permissões por área do CRM" ariaLabel="Abrir perfis e acessos" onClick={() => {}} />
        <SettingsCatalogLink title="Etapas do funil" description="Nome, cor e etapa inicial dos leads" ariaLabel="Abrir etapas do funil" count={6} onClick={() => {}} />
      </div>
    </Surface>
  </main>,
);
