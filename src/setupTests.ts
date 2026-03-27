import { vi } from 'vitest';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

if (!window.URL.createObjectURL) {
  window.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
}

if (!window.URL.revokeObjectURL) {
  window.URL.revokeObjectURL = vi.fn();
}

if (!('scrollIntoView' in Element.prototype)) {
  (Element.prototype as unknown as { scrollIntoView: () => void }).scrollIntoView = vi.fn();
}

if (!navigator.mediaDevices) {
  Object.defineProperty(navigator, 'mediaDevices', {
    value: {
      getUserMedia: vi.fn(),
    },
    configurable: true,
  });
} else if (!navigator.mediaDevices.getUserMedia) {
  navigator.mediaDevices.getUserMedia = vi.fn() as unknown as typeof navigator.mediaDevices.getUserMedia;
}

if (!(globalThis as typeof globalThis & { MediaRecorder?: unknown }).MediaRecorder) {
  class MediaRecorderMock {
    static isTypeSupported = vi.fn(() => true);
    mimeType = 'audio/webm;codecs=opus';
    state: 'inactive' | 'recording' | 'paused' = 'inactive';
    ondataavailable: ((event: BlobEvent) => void) | null = null;
    onstop: (() => void) | null = null;
    onerror: ((event: Event) => void) | null = null;

    start() {
      this.state = 'recording';
    }

    stop() {
      this.state = 'inactive';
      this.onstop?.();
    }
  }

  Object.defineProperty(globalThis, 'MediaRecorder', {
    value: MediaRecorderMock,
    configurable: true,
  });
}
