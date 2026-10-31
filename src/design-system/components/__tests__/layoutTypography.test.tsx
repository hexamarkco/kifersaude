import assert from 'node:assert/strict';
import { render } from '@testing-library/react';
import { test } from 'vitest';

import { ExternalLink, Heading, InfoTooltip, Inline, PublicCard, PublicShell, Stack, Text } from '../../index';

test('layout primitives expose tokenized composition classes and semantic elements', () => {
  const { container, unmount } = render(
    <PublicShell width="narrow">
      <Stack as="main" gap="lg" align="center">
        <Heading level={1}>Título</Heading>
        <Text size="sm" tone="muted">Descrição</Text>
        <Inline gap="sm" justify="between"><PublicCard>Conteúdo</PublicCard></Inline>
      </Stack>
    </PublicShell>,
  );
  assert.ok(container.querySelector('main.kds-stack.kds-stack-gap-lg'));
  assert.ok(container.querySelector('.kds-public-width-narrow'));
  assert.ok(container.querySelector('h1.kds-heading.kds-heading-display'));
  assert.ok(container.querySelector('p.kds-text.kds-text-sm.kds-text-tone-muted'));
  assert.ok(container.querySelector('.kds-inline.kds-inline-wrap.kds-stack-gap-sm.kds-stack-justify-between'));
  unmount();
});

test('TextLink preserves external link security defaults and supports explicit semantics', () => {
  const { container, unmount } = render(<ExternalLink href="https://example.com" external underline>Externo</ExternalLink>);
  const link = container.querySelector('a');
  assert.ok(link);
  assert.equal(link.target, '_blank');
  assert.equal(link.rel, 'noopener noreferrer');
  assert.match(link.className, /kds-text-link-underlined/);
  unmount();
});

test('InfoTooltip aligns beside card headings in the shared title row', () => {
  const { container, unmount } = render(
    <div className="kds-card-title-row">
      <Heading level={4} className="kds-card-title">Envio automático</Heading>
      <InfoTooltip content="Pausa ou libera o processamento dos fluxos ativos." label="Informações sobre o processamento dos fluxos" />
    </div>,
  );
  const row = container.querySelector('.kds-card-title-row');
  const heading = row?.querySelector('h4.kds-card-title');
  const info = row?.querySelector('button.kds-info-trigger');
  assert.equal(heading?.textContent, 'Envio automático');
  assert.equal(info?.getAttribute('aria-label'), 'Informações sobre o processamento dos fluxos');
  assert.equal(heading?.parentElement, row);
  assert.equal(info?.parentElement?.parentElement, row);
  unmount();
});
