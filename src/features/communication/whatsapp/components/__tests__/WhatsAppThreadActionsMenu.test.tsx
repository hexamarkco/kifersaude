import assert from 'node:assert/strict';
import { act, createRef, type ComponentProps } from 'react';
import { test, vi } from 'vitest';

import { render } from '../../../../../testing-library/react';
import { WhatsAppThreadActionsMenu } from '../WhatsAppThreadActionsMenu';

const createProps = (): ComponentProps<typeof WhatsAppThreadActionsMenu> => ({
  menuRef: createRef<HTMLDivElement>(),
  isOpen: true,
  position: { top: 0, left: 0, width: 288, maxHeight: 400 },
  onClose: vi.fn(),
  historyRecoveryDisabledReason: null,
  syncingHistory: false,
  onOpenChatFiles: vi.fn(),
  onToggleChatMessageSearch: vi.fn(),
  onOpenScheduledMessages: vi.fn(),
  onRecoverHistory: vi.fn(),
});

const getMenuItems = () => {
  const menu = document.body.querySelector('[aria-label="Ações da conversa"]');
  assert.ok(menu instanceof HTMLDivElement);
  return Array.from(menu.querySelectorAll<HTMLButtonElement>('button[role="menuitem"]'));
};

test('oferece as ações de grupo e fecha o menu antes de abrir os arquivos', () => {
  const calls: string[] = [];
  const view = render(
    <WhatsAppThreadActionsMenu
      {...createProps()}
      onClose={() => calls.push('fechar')}
      onOpenChatFiles={() => calls.push('arquivos')}
    />,
  );

  try {
    const items = getMenuItems();
    assert.deepEqual(items.map((item) => item.textContent), [
      'Arquivos da conversa',
      'Pesquisar neste chat',
      'Mensagens agendadas desta conversa',
      'Recuperar histórico antigo',
    ]);
    act(() => items[0].click());
    assert.deepEqual(calls, ['fechar', 'arquivos']);
  } finally {
    view.unmount();
  }
});

test('exibe o motivo quando a recuperação de histórico está indisponível', () => {
  const view = render(<WhatsAppThreadActionsMenu {...createProps()} historyRecoveryDisabledReason="Canal indisponível" />);

  try {
    const recover = getMenuItems().find((item) => item.textContent === 'Recuperar histórico antigo');
    assert.equal(recover?.disabled, true);
    assert.equal(recover?.title, 'Canal indisponível');
  } finally {
    view.unmount();
  }
});
