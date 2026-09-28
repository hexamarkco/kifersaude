import assert from 'node:assert/strict';
import { test } from 'vitest';

import { render } from '../../../../../testing-library/react';
import { WhatsAppInboxConversationPane } from '../WhatsAppInboxConversationPane';

const createPane = (isDraggingFilesOverThread: boolean) => (
  <WhatsAppInboxConversationPane
    conversation={null}
    isDraggingFilesOverThread={isDraggingFilesOverThread}
    onDragEnter={() => undefined}
    onDragOver={() => undefined}
    onDragLeave={() => undefined}
    onDrop={() => undefined}
  />
);

test('exibe o estado vazio quando nenhuma conversa está selecionada', () => {
  const view = render(createPane(false));

  try {
    assert.ok(view.container.textContent?.includes('Selecione uma conversa'));
    assert.ok(view.container.textContent?.includes('Abra um chat na coluna da esquerda'));
    assert.equal(view.container.querySelector('.whatsapp-inbox-empty-icon') !== null, true);
  } finally {
    view.unmount();
  }
});

test('mostra a indicação de anexo enquanto arquivos são arrastados sobre a conversa', () => {
  const view = render(createPane(true));

  try {
    assert.ok(view.container.textContent?.includes('Solte para anexar à conversa'));
  } finally {
    view.unmount();
  }
});
