import assert from 'node:assert/strict';
import { act, useState } from 'react';
import { render } from '@testing-library/react';
import { test } from 'vitest';

import type { AutoContactFlowStep, AutoContactTemplate } from '../../../../lib/autoContactService';
import { MessageListEditor } from './MessageListEditor';

const createStep = (): AutoContactFlowStep => ({
  id: 'step-1',
  delayValue: 1,
  delayUnit: 'days',
  actionType: 'send_message',
  messages: [
    { custom: { type: 'text', text: 'Mensagem A' } },
    { custom: { type: 'text', text: 'Mensagem B' } },
  ],
});

test('mantém o campo de edição correto ao mover uma mensagem', () => {
  const templates: AutoContactTemplate[] = [];
  const { container, unmount } = render(<ControlledMessageList templates={templates} />);
  const textareasBeforeMove = Array.from(container.querySelectorAll<HTMLTextAreaElement>('textarea'));
  const moveUpButtons = Array.from(container.querySelectorAll<HTMLButtonElement>('button[aria-label="Mover para cima"]'));

  assert.equal(textareasBeforeMove.map((textarea) => textarea.value).join('|'), 'Mensagem A|Mensagem B');
  assert.equal(moveUpButtons.length, 2);

  act(() => {
    moveUpButtons[1].click();
  });

  const textareasAfterMove = Array.from(container.querySelectorAll<HTMLTextAreaElement>('textarea'));
  assert.equal(textareasAfterMove.map((textarea) => textarea.value).join('|'), 'Mensagem B|Mensagem A');
  assert.strictEqual(textareasAfterMove[0], textareasBeforeMove[1]);
  assert.strictEqual(textareasAfterMove[1], textareasBeforeMove[0]);

  unmount();
});

function ControlledMessageList({ templates }: { templates: AutoContactTemplate[] }) {
  const [step, setStep] = useState(createStep);

  return (
    <MessageListEditor
      step={step}
      messageTemplates={templates}
      onUpdate={(messages) => setStep((current) => ({ ...current, messages }))}
    />
  );
}
