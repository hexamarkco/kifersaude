import assert from 'node:assert/strict';
import { act, useState } from 'react';
import { test } from 'vitest';

import { render } from '../../../../../testing-library/react';
import { useMediaViewerImageControls } from '../useMediaViewerImageControls';

type Controls = ReturnType<typeof useMediaViewerImageControls>;

const mountControls = () => {
  let controls!: Controls;
  let selectMessage!: (id: string) => void;
  function Harness() {
    const [messageId, setMessageId] = useState('image-1');
    selectMessage = setMessageId;
    controls = useMediaViewerImageControls(messageId);
    return <div onPointerDown={controls.onPointerDown} onPointerMove={controls.onPointerMove} onPointerUp={controls.onPointerEnd} />;
  }
  const mounted = render(<Harness />);
  const stage = mounted.container.firstElementChild as HTMLDivElement;
  stage.setPointerCapture = () => {};
  return { ...mounted, stage, get controls() { return controls; }, selectMessage: (id: string) => selectMessage(id) };
};

const pointer = (stage: HTMLElement, type: string, x: number, y: number) => {
  const event = new MouseEvent(type, { bubbles: true, clientX: x, clientY: y, button: 0 });
  Object.defineProperty(event, 'pointerId', { value: 1 });
  act(() => stage.dispatchEvent(event));
};

test('limita o zoom e restaura a visualização ao trocar de imagem', () => {
  const mounted = mountControls();
  try {
    act(() => mounted.controls.changeZoom(10));
    assert.equal(mounted.controls.zoom, 4);
    act(() => mounted.controls.rotate());
    assert.equal(mounted.controls.rotation, 1);
    act(() => mounted.selectMessage('image-2'));
    assert.equal(mounted.controls.zoom, 1);
    assert.equal(mounted.controls.rotation, 0);
    act(() => mounted.controls.changeZoom(0.5));
    assert.equal(mounted.controls.zoom, 1);
  } finally {
    mounted.unmount();
  }
});

test('arrasta somente a imagem ampliada e recentraliza ao ajustar à tela', () => {
  const mounted = mountControls();
  try {
    pointer(mounted.stage, 'pointerdown', 10, 20);
    pointer(mounted.stage, 'pointermove', 40, 70);
    assert.deepEqual(mounted.controls.offset, { x: 0, y: 0 });
    act(() => mounted.controls.changeZoom(2));
    pointer(mounted.stage, 'pointerdown', 10, 20);
    pointer(mounted.stage, 'pointermove', 40, 70);
    assert.deepEqual(mounted.controls.offset, { x: 30, y: 50 });
    pointer(mounted.stage, 'pointerup', 40, 70);
    pointer(mounted.stage, 'pointermove', 80, 100);
    assert.deepEqual(mounted.controls.offset, { x: 30, y: 50 });
    act(() => mounted.controls.changeZoom(1));
    assert.deepEqual(mounted.controls.offset, { x: 0, y: 0 });
  } finally {
    mounted.unmount();
  }
});
