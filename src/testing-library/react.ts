import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import type { ReactElement } from 'react';

type RenderResult = {
  container: HTMLElement;
  unmount: () => void;
};

let lastRenderContainer: HTMLElement | null = null;

const waitFor = async <T>(callback: () => T, timeout = 1000, interval = 16): Promise<T> => {
  const start = Date.now();
  return new Promise<T>((resolve, reject) => {
    const check = () => {
      try {
        const result = callback();
        resolve(result);
      } catch (error) {
        if (Date.now() - start >= timeout) {
          reject(error);
          return;
        }
        setTimeout(check, interval);
      }
    };
    check();
  });
};

const getSearchRoot = () => lastRenderContainer ?? document.body;

const queryByText = (text: string): HTMLElement | null => {
  const root = getSearchRoot();
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
  let current = walker.nextNode() as HTMLElement | null;
  while (current) {
    if ((current.textContent ?? '').includes(text)) {
      return current;
    }
    current = walker.nextNode() as HTMLElement | null;
  }
  return null;
};

const queryByPlaceholderText = (placeholder: string): HTMLElement | null => {
  const root = getSearchRoot();
  const elements = Array.from(root.querySelectorAll('input,textarea')) as HTMLElement[];
  return elements.find((element) => element.getAttribute('placeholder') === placeholder) ?? null;
};

const assignEventProperty = (event: Event, property: 'dataTransfer' | 'clipboardData', value: unknown) => {
  if (typeof value === 'undefined') {
    return;
  }
  Object.defineProperty(event, property, {
    value,
    configurable: true,
  });
};

const dispatchSyntheticEvent = (
  element: Element,
  type: string,
  property: 'dataTransfer' | 'clipboardData' | null,
  value?: unknown,
) => {
  const event = new Event(type, { bubbles: true, cancelable: true });
  if (property) {
    assignEventProperty(event, property, value);
  }
  act(() => {
    element.dispatchEvent(event);
  });
  return event;
};

export const render = (ui: ReactElement): RenderResult => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root: Root = createRoot(container);
  act(() => {
    root.render(ui);
  });
  lastRenderContainer = container;

  return {
    container,
    unmount: () => {
      act(() => {
        root.unmount();
      });
      if (container.parentNode) {
        container.parentNode.removeChild(container);
      }
      if (lastRenderContainer === container) {
        lastRenderContainer = null;
      }
    },
  };
};

export const screen = {
  findByText: (text: string) =>
    waitFor(() => {
      const element = queryByText(text);
      if (!element) {
        throw new Error(`Unable to find element with text: ${text}`);
      }
      return element;
    }),
  findByPlaceholderText: (placeholder: string) =>
    waitFor(() => {
      const element = queryByPlaceholderText(placeholder);
      if (!element) {
        throw new Error(`Unable to find element with placeholder: ${placeholder}`);
      }
      return element;
    }),
};

export const fireEvent = {
  dragOver: (element: Element, init: { dataTransfer?: unknown } = {}) =>
    dispatchSyntheticEvent(element, 'dragover', 'dataTransfer', init.dataTransfer),
  drop: (element: Element, init: { dataTransfer?: unknown } = {}) =>
    dispatchSyntheticEvent(element, 'drop', 'dataTransfer', init.dataTransfer),
  paste: (element: Element, init: { clipboardData?: unknown } = {}) =>
    dispatchSyntheticEvent(element, 'paste', 'clipboardData', init.clipboardData),
};

export default {
  render,
  screen,
  fireEvent,
};
