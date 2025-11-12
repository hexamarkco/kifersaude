import { vi } from 'vitest';

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
  navigator.mediaDevices.getUserMedia = vi.fn();
}
