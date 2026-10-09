import { useEffect, useRef, useState, type PointerEvent } from 'react';

export function useMediaViewerImageControls(messageId: string) {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ pointerId: number; x: number; y: number } | null>(null);

  useEffect(() => {
    setZoom(1);
    setRotation(0);
    setOffset({ x: 0, y: 0 });
    dragRef.current = null;
  }, [messageId]);

  const changeZoom = (nextZoom: number) => {
    setZoom(Math.min(4, Math.max(1, nextZoom)));
    setOffset({ x: 0, y: 0 });
    dragRef.current = null;
  };

  const rotate = () => {
    setRotation((current) => (current + 1) % 4);
    setOffset({ x: 0, y: 0 });
    dragRef.current = null;
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (zoom === 1 || event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      x: event.clientX - offset.x,
      y: event.clientY - offset.y,
    };
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    setOffset({ x: event.clientX - drag.x, y: event.clientY - drag.y });
  };

  const onPointerEnd = () => {
    dragRef.current = null;
  };

  return { zoom, rotation, offset, changeZoom, rotate, onPointerDown, onPointerMove, onPointerEnd };
}
