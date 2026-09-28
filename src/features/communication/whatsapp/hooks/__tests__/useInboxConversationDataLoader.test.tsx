import assert from 'node:assert/strict';
import { act, useState } from 'react';
import { test, vi } from 'vitest';

import { render } from '../../../../../testing-library/react';
import { useInboxConversationDataLoader } from '../useInboxConversationDataLoader';

const mocks = vi.hoisted(() => ({
  chats: null as unknown,
  messages: null as unknown,
}));

vi.mock('../useInboxChatLoader', () => ({
  useInboxChatLoader: () => mocks.chats,
}));

vi.mock('../useInboxMessageLoader', () => ({
  useInboxMessageLoader: () => mocks.messages,
}));

type Controller = ReturnType<typeof useInboxConversationDataLoader>;
type ControllerOptions = Parameters<typeof useInboxConversationDataLoader>[0];
type RerenderControl = { rerender: (() => void) | null };

const Harness = ({ options, capture, control }: {
  options: ControllerOptions;
  capture: (controller: Controller) => void;
  control: RerenderControl;
}) => {
  const [, setRenderVersion] = useState(0);
  control.rerender = () => setRenderVersion((current) => current + 1);
  capture(useInboxConversationDataLoader(options));
  return null;
};

const createOptions = (): ControllerOptions => ({
  chatLoader: {} as unknown as ControllerOptions['chatLoader'],
  messageLoader: {} as unknown as ControllerOptions['messageLoader'],
  refs: {
    loadChatsRef: { current: () => undefined },
    loadMessagesRef: { current: () => undefined },
  },
});

test('mantém as refs de refresh apontando para os loaders da renderização atual', () => {
  const options = createOptions();
  const loadChatsFirst = () => Promise.resolve('chats-first');
  const loadMessagesFirst = () => Promise.resolve('messages-first');
  const handleLoadMoreArchivedChats = () => Promise.resolve();
  const handleSwitchArchivedSection = () => undefined;
  mocks.chats = {
    loadChats: loadChatsFirst,
    handleLoadMoreArchivedChats,
    handleSwitchArchivedSection,
  };
  mocks.messages = { loadMessages: loadMessagesFirst };

  const controllers: Controller[] = [];
  const control: RerenderControl = { rerender: null };
  const view = render(<Harness options={options} capture={(next) => { controllers.push(next); }} control={control} />);

  const firstController = controllers[0];
  if (!firstController) {
    throw new Error('Conversation data loader was not captured.');
  }

  assert.equal(options.refs.loadChatsRef.current, loadChatsFirst);
  assert.equal(options.refs.loadMessagesRef.current, loadMessagesFirst);
  assert.equal(firstController.loadChats, loadChatsFirst);
  assert.equal(firstController.loadMessages, loadMessagesFirst);
  assert.equal(firstController.handleLoadMoreArchivedChats, handleLoadMoreArchivedChats);
  assert.equal(firstController.handleSwitchArchivedSection, handleSwitchArchivedSection);

  const loadChatsNext = () => Promise.resolve('chats-next');
  const loadMessagesNext = () => Promise.resolve('messages-next');
  mocks.chats = { loadChats: loadChatsNext, handleLoadMoreArchivedChats, handleSwitchArchivedSection };
  mocks.messages = { loadMessages: loadMessagesNext };
  act(() => control.rerender?.());

  assert.equal(options.refs.loadChatsRef.current, loadChatsNext);
  assert.equal(options.refs.loadMessagesRef.current, loadMessagesNext);

  view.unmount();
});
