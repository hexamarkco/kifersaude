import assert from 'node:assert/strict';
import { act, useRef, useState, type ChangeEvent } from 'react';
import { test } from 'vitest';

import { render } from '../../../../../testing-library/react';
import { getActiveQuickReplyMatch } from '../../domain/quickReplies';
import { useInboxComposerTextActions } from '../useInboxComposerTextActions';

type Selection = { start: number; end: number };
type Snapshot = {
  draft: string;
  selection: Selection;
  focused: boolean;
  dismissed: string | null;
  activeIndex: number;
  resizeCount: number;
};

const Harness = ({ initialDraft, initialSelection }: { initialDraft: string; initialSelection: Selection }) => {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [draft, setDraft] = useState(initialDraft);
  const [selection, setSelection] = useState(initialSelection);
  const [focused, setFocused] = useState(false);
  const [dismissed, setDismissed] = useState<string | null>('3:sa');
  const [activeIndex, setActiveIndex] = useState(2);
  const [resizeCount, setResizeCount] = useState(0);
  const actions = useInboxComposerTextActions({
    textareaRef,
    messageDraft: draft,
    setMessageDraft: setDraft,
    composerSelection: selection,
    setComposerSelection: setSelection,
    setComposerFocused: setFocused,
    activeQuickReplyMatch: getActiveQuickReplyMatch(draft, selection),
    setDismissedQuickReplyKey: setDismissed,
    setQuickReplyActiveIndex: setActiveIndex,
    resizeComposerTextarea: () => setResizeCount((current) => current + 1),
  });
  const snapshot: Snapshot = { draft, selection, focused, dismissed, activeIndex, resizeCount };

  const withSelection = (command: () => void) => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.setSelectionRange(initialSelection.start, initialSelection.end);
    }
    command();
  };

  return (
    <>
      <textarea ref={textareaRef} value={draft} onChange={actions.handleComposerChange} />
      <output data-testid="snapshot">{JSON.stringify(snapshot)}</output>
      <button data-testid="quick-reply" onClick={() => withSelection(() => actions.handleInsertQuickReply({ text: 'Resposta' }))}>Quick reply</button>
      <button data-testid="emoji" onClick={() => withSelection(() => actions.handleInsertEmoji('🙂'))}>Emoji</button>
      <button data-testid="format" onClick={() => withSelection(() => actions.handleApplyComposerTextFormat('italic'))}>Format</button>
      <button
        data-testid="change"
        onClick={() => {
          const target = textareaRef.current;
          if (!target) return;
          target.value = 'Texto atualizado';
          target.setSelectionRange(4, 4);
          actions.handleComposerChange({ target } as unknown as ChangeEvent<HTMLTextAreaElement>);
        }}
      >
        Change
      </button>
    </>
  );
};

const readSnapshot = (container: HTMLElement): Snapshot => {
  const content = container.querySelector('[data-testid="snapshot"]')?.textContent;
  assert.ok(content);
  return JSON.parse(content) as Snapshot;
};

const click = (container: HTMLElement, testId: string) => {
  const button = container.querySelector(`[data-testid="${testId}"]`);
  assert.ok(button);
  act(() => {
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
};

test('insere uma resposta rápida no lugar do comando e reseta o menu', () => {
  const view = render(<Harness initialDraft="Oi /sa" initialSelection={{ start: 6, end: 6 }} />);
  click(view.container, 'quick-reply');

  const snapshot = readSnapshot(view.container);
  assert.equal(snapshot.draft, 'Oi Resposta');
  assert.deepEqual(snapshot.selection, { start: 11, end: 11 });
  assert.equal(snapshot.dismissed, null);
  assert.equal(snapshot.activeIndex, 0);
  view.unmount();
});

test('substitui a seleção por emoji e atualiza o cursor', () => {
  const view = render(<Harness initialDraft="Oi mundo" initialSelection={{ start: 3, end: 8 }} />);
  click(view.container, 'emoji');

  const snapshot = readSnapshot(view.container);
  assert.equal(snapshot.draft, 'Oi 🙂');
  assert.deepEqual(snapshot.selection, { start: 5, end: 5 });
  assert.equal(snapshot.focused, true);
  view.unmount();
});

test('formata o texto selecionado e sincroniza alterações e tamanho do composer', () => {
  const view = render(<Harness initialDraft="texto" initialSelection={{ start: 1, end: 4 }} />);
  click(view.container, 'format');

  let snapshot = readSnapshot(view.container);
  assert.equal(snapshot.draft, 't_ext_o');
  assert.deepEqual(snapshot.selection, { start: 6, end: 6 });
  assert.equal(snapshot.focused, true);

  click(view.container, 'change');
  snapshot = readSnapshot(view.container);
  assert.equal(snapshot.draft, 'Texto atualizado');
  assert.deepEqual(snapshot.selection, { start: 4, end: 4 });
  assert.equal(snapshot.resizeCount, 1);
  view.unmount();
});
