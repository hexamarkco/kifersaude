import assert from 'node:assert/strict';
import { act, type KeyboardEvent } from 'react';
import { test } from 'vitest';

import { render } from '../../../../../testing-library/react';
import type { PendingAttachment } from '../../domain/outgoingMessageTypes';
import { useInboxComposerSubmission } from '../useInboxComposerSubmission';

type SubmissionOptions = Parameters<typeof useInboxComposerSubmission>[0];
type Submission = ReturnType<typeof useInboxComposerSubmission>;

const quickReplies: SubmissionOptions['filteredQuickReplyOptions'] = [
  { id: 'reply-a', name: 'A', shortcut: 'a', text: 'Resposta A', preview: 'Resposta A', searchValue: 'a' },
  { id: 'reply-b', name: 'B', shortcut: 'b', text: 'Resposta B', preview: 'Resposta B', searchValue: 'b' },
];
const voiceAttachment: PendingAttachment = {
  id: 'voice-1',
  file: new File([], 'voice.webm', { type: 'audio/webm' }),
  kind: 'voice',
};

const createContext = (overrides: Partial<SubmissionOptions> = {}) => {
  const calls: string[] = [];
  let activeIndex = 0;
  let dismissedKey: string | null = null;
  const options: SubmissionOptions = {
    generatingFollowUp: false,
    voiceRecordingState: 'idle',
    voiceAttachment: null,
    hasSendPayload: true,
    quickReplyMenuOpen: false,
    quickReplyMenuHasResults: false,
    filteredQuickReplyOptions: [],
    quickReplyActiveIndex: 0,
    activeQuickReplyKey: null,
    replySuggestionText: '',
    replySuggestionLoading: false,
    autoSendVoiceRef: { current: false },
    setQuickReplyActiveIndex: (update) => {
      activeIndex = typeof update === 'function' ? update(activeIndex) : update;
      calls.push(`quick-reply-index:${activeIndex}`);
    },
    setDismissedQuickReplyKey: (update) => {
      dismissedKey = typeof update === 'function' ? update(dismissedKey) : update;
      calls.push(`dismissed:${dismissedKey ?? 'null'}`);
    },
    handleInsertQuickReply: (option) => calls.push(`insert:${option.id}`),
    handleApplyReplySuggestion: () => calls.push('apply-suggestion'),
    handleSendMessage: () => calls.push('send'),
    handleStartVoiceRecording: () => calls.push('start-recording'),
    handleStopVoiceRecording: (autoSend) => calls.push(`stop-recording:${Boolean(autoSend)}`),
    ...overrides,
  };

  return {
    calls,
    options,
    getActiveIndex: () => activeIndex,
    getDismissedKey: () => dismissedKey,
  };
};

const Harness = ({ options, capture }: {
  options: SubmissionOptions;
  capture: (submission: Submission) => void;
}) => {
  capture(useInboxComposerSubmission(options));
  return null;
};

const mount = (options: SubmissionOptions) => {
  const captured: Submission[] = [];
  const view = render(<Harness options={options} capture={(next) => { captured.push(next); }} />);
  const submission = captured[0];
  if (!submission) {
    throw new Error('Composer submission hook was not captured.');
  }
  return { view, submission };
};

const press = (submission: Submission, key: string, shiftKey = false) => {
  let prevented = false;
  const event = {
    key,
    shiftKey,
    preventDefault: () => { prevented = true; },
  } as unknown as KeyboardEvent<HTMLTextAreaElement>;

  act(() => submission.handleComposerKeyDown(event));
  return prevented;
};

test('navega, seleciona e fecha respostas rápidas antes dos atalhos seguintes', () => {
  const navigation = createContext({
    quickReplyMenuOpen: true,
    quickReplyMenuHasResults: true,
    filteredQuickReplyOptions: quickReplies,
    quickReplyActiveIndex: 0,
    activeQuickReplyKey: '0:ola',
  });
  const navigationView = mount(navigation.options);

  assert.equal(press(navigationView.submission, 'ArrowDown'), true);
  assert.equal(navigation.getActiveIndex(), 1);
  navigationView.view.unmount();

  const context = createContext({
    quickReplyMenuOpen: true,
    quickReplyMenuHasResults: true,
    filteredQuickReplyOptions: quickReplies,
    quickReplyActiveIndex: 1,
    activeQuickReplyKey: '0:ola',
  });
  const { view, submission } = mount(context.options);

  assert.equal(press(submission, 'Enter'), true);
  assert.deepEqual(context.calls.slice(-1), ['insert:reply-b']);
  assert.equal(press(submission, 'Escape'), true);
  assert.equal(context.getDismissedKey(), '0:ola');
  assert.equal(context.getActiveIndex(), 0);
  assert.equal(context.calls.includes('send'), false);

  view.unmount();
});

test('Tab aplica sugestão pronta e Enter envia sem interferir em Shift+Enter', () => {
  const context = createContext({ replySuggestionText: 'Sugestão pronta' });
  const { view, submission } = mount(context.options);

  assert.equal(press(submission, 'Tab'), true);
  assert.equal(press(submission, 'Enter', true), false);
  assert.equal(press(submission, 'Enter'), true);
  assert.deepEqual(context.calls, ['apply-suggestion', 'send']);

  view.unmount();
});

test('não envia Enter durante gravação ou quando há anexo de voz', () => {
  const recording = createContext({ voiceRecordingState: 'recording' });
  const recordingView = mount(recording.options);
  assert.equal(press(recordingView.submission, 'Enter'), false);
  assert.deepEqual(recording.calls, []);
  recordingView.view.unmount();

  const attachment = createContext({ voiceAttachment });
  const attachmentView = mount(attachment.options);
  assert.equal(press(attachmentView.submission, 'Enter'), false);
  assert.deepEqual(attachment.calls, []);
  attachmentView.view.unmount();
});

test('submete conforme o estado: bloqueia follow-up, encerra gravação, envia payload ou inicia gravação', () => {
  const blocked = createContext({ generatingFollowUp: true });
  const blockedView = mount(blocked.options);
  act(() => blockedView.submission.handleComposerSubmit());
  assert.deepEqual(blocked.calls, []);
  blockedView.view.unmount();

  const recording = createContext({ voiceRecordingState: 'recording' });
  const recordingView = mount(recording.options);
  act(() => recordingView.submission.handleComposerSubmit());
  assert.deepEqual(recording.calls, ['stop-recording:false']);
  recordingView.view.unmount();

  const sending = createContext({ hasSendPayload: true });
  const sendingView = mount(sending.options);
  act(() => sendingView.submission.handleComposerSubmit());
  assert.deepEqual(sending.calls, ['send']);
  sendingView.view.unmount();

  const empty = createContext({ hasSendPayload: false });
  const emptyView = mount(empty.options);
  act(() => emptyView.submission.handleComposerSubmit());
  assert.deepEqual(empty.calls, ['start-recording']);
  emptyView.view.unmount();
});

test('envia gravação finalizada ao clicar e consome a intenção de autoenvio uma única vez', () => {
  const activeRecording = createContext({ voiceRecordingState: 'recording' });
  const activeView = mount(activeRecording.options);
  act(() => activeView.submission.handleSendCurrentVoiceRecording());
  assert.deepEqual(activeRecording.calls, ['stop-recording:true']);
  activeView.view.unmount();

  const autoSend = createContext({ voiceAttachment, autoSendVoiceRef: { current: true } });
  const autoView = mount(autoSend.options);
  assert.deepEqual(autoSend.calls, ['send']);
  assert.equal(autoSend.options.autoSendVoiceRef.current, false);
  autoView.view.unmount();

  const reopened = mount(autoSend.options);
  assert.deepEqual(autoSend.calls, ['send']);
  reopened.view.unmount();

  const readyToSend = createContext({ voiceAttachment });
  const readyView = mount(readyToSend.options);
  act(() => readyView.submission.handleSendCurrentVoiceRecording());
  assert.deepEqual(readyToSend.calls, ['send']);
  readyView.view.unmount();
});
