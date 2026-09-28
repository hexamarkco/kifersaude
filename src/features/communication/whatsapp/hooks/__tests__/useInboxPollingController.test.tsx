import assert from 'node:assert/strict';
import { test, vi } from 'vitest';

import { render } from '../../../../../testing-library/react';
import { useInboxPollingController } from '../useInboxPollingController';

const mocks = vi.hoisted(() => ({
  pollingOptions: [] as unknown[],
  selectedChatPreviewOptions: [] as unknown[],
  messageStatusRefreshOptions: [] as unknown[],
  scheduleMessageStatusRefresh: () => undefined,
}));

vi.mock('../useInboxPolling', () => ({
  useInboxPolling: (options: unknown) => {
    mocks.pollingOptions.push(options);
  },
}));

vi.mock('../useInboxSelectedChatPreviewRefresh', () => ({
  useInboxSelectedChatPreviewRefresh: (options: unknown) => {
    mocks.selectedChatPreviewOptions.push(options);
  },
}));

vi.mock('../useInboxMessageStatusRefresh', () => ({
  useInboxMessageStatusRefresh: (options: unknown) => {
    mocks.messageStatusRefreshOptions.push(options);
    return { scheduleMessageStatusRefresh: mocks.scheduleMessageStatusRefresh };
  },
}));

type ControllerOptions = Parameters<typeof useInboxPollingController>[0];
type Controller = ReturnType<typeof useInboxPollingController>;

const Harness = ({ options, capture }: {
  options: ControllerOptions;
  capture: (controller: Controller) => void;
}) => {
  capture(useInboxPollingController(options));
  return null;
};

const createOptions = (): ControllerOptions => ({
  realtimeRefs: {
    isChannelConnectedRef: { current: true },
    isMessageRealtimeHealthyRef: { current: false },
  },
  polling: {} as unknown as ControllerOptions['polling'],
  selectedChatPreviewRefresh: {} as unknown as ControllerOptions['selectedChatPreviewRefresh'],
  messageStatusRefresh: {} as unknown as ControllerOptions['messageStatusRefresh'],
});

test('conecta o estado Realtime ao polling e compõe refreshes do chat selecionado', () => {
  mocks.pollingOptions.length = 0;
  mocks.selectedChatPreviewOptions.length = 0;
  mocks.messageStatusRefreshOptions.length = 0;
  const options = createOptions();
  const captured: Controller[] = [];
  const view = render(<Harness options={options} capture={(controller) => captured.push(controller)} />);

  try {
    const controller = captured[0];
    if (!controller) {
      throw new Error('Inbox polling controller was not captured.');
    }

    assert.deepEqual(mocks.pollingOptions, [{ ...options.polling, ...options.realtimeRefs }]);
    assert.equal(mocks.selectedChatPreviewOptions[0], options.selectedChatPreviewRefresh);
    assert.equal(mocks.messageStatusRefreshOptions[0], options.messageStatusRefresh);
    assert.equal(controller.scheduleMessageStatusRefresh, mocks.scheduleMessageStatusRefresh);
  } finally {
    view.unmount();
  }
});
