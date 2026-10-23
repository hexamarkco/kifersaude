import { render } from '@testing-library/react';
import { Helmet } from 'react-helmet';
import assert from 'node:assert/strict';
import { test } from 'vitest';
import { indexablePublicRoutes } from '../../../scripts/seo-routes';
import { siteConfig } from '../../config/site';
import PrivacyPolicyPage from './PrivacyPolicyPage';
import PrivacyNotice from './components/PrivacyNotice';

// Sem AuthProvider nem mocks de APIs: o documento precisa renderizar sozinho.
test('renderiza sem sessão, com canais reais, revisão explícita e seções acessíveis', () => {
  const view = render(<PrivacyPolicyPage />);
  assert.equal(view.container.querySelector('h1')?.textContent, 'Política de Privacidade');
  const sections = [...view.container.querySelectorAll('main section')];
  assert.equal(sections.length, 13);
  for (const section of sections) {
    assert.ok(view.container.querySelector(`[id="${section.getAttribute('aria-labelledby')}"]`));
  }
  assert.ok(view.container.textContent?.includes('Revisão antes da publicação'));
  assert.ok(view.container.textContent?.includes(siteConfig.cnpj));
  assert.ok(view.container.querySelector(`a[href="mailto:${siteConfig.email}"]`));
  assert.ok(view.container.querySelector('footer a[href="/politica-de-privacidade"]'));
  assert.equal(view.container.querySelector('time')?.getAttribute('dateTime'), '2026-10-23');
  assert.equal(view.container.querySelector('form'), null);
  view.unmount();
});

test('mantém metadata e descoberta da URL pública', () => {
  Helmet.canUseDOM = false;
  const view = render(<PrivacyPolicyPage />);
  const head = Helmet.rewind();
  assert.ok(head.title.toString().includes('Política de Privacidade | Kifer Saúde'));
  assert.ok(head.meta.toString().includes('Saiba como a Kifer Saúde coleta, utiliza, compartilha e protege seus dados pessoais, em conformidade com a LGPD.'));
  assert.ok(head.link.toString().includes(`${siteConfig.url}/politica-de-privacidade`));
  assert.ok(indexablePublicRoutes.includes('/politica-de-privacidade'));
  Helmet.canUseDOM = true;
  view.unmount();
});

test('permite ler a política sem perder dados do formulário', () => {
  const view = render(<PrivacyNotice />);
  const link = view.container.querySelector('a');
  assert.equal(link?.getAttribute('href'), '/politica-de-privacidade');
  assert.equal(link?.getAttribute('target'), '_blank');
  assert.ok(link?.textContent?.includes('nova aba'));
  assert.equal(view.container.querySelector('input'), null);
  view.unmount();
});
