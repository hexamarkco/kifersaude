import { useEffect, useId, useRef, useState, type PointerEvent } from 'react';
import { clampCropPosition, cropImageFile, getSquareImageCrop, type ImageCropPosition } from '../../lib/imageCrop';
import Alert from './Alert';
import Button from './Button';
import { DialogShell } from './Dialog';
import Field from './Field';
import Slider from './Slider';
import { Text } from './Typography';

export type ImageCropDialogProps = {
  file: File;
  onCancel: () => void;
  onConfirm: (file: File) => Promise<void>;
};

const centered: ImageCropPosition = { x: 0.5, y: 0.5, zoom: 1 };

export default function ImageCropDialog({ file, onCancel, onConfirm }: ImageCropDialogProps) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [position, setPosition] = useState(centered);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const drag = useRef<{ id: number; x: number; y: number; position: ImageCropPosition } | null>(null);
  const instructionsId = useId();

  useEffect(() => {
    const url = URL.createObjectURL(file);
    const photo = new window.Image();
    let active = true;
    photo.onload = () => {
      if (!active) return;
      if (photo.naturalWidth && photo.naturalHeight) setImage(photo);
      else setError('Esta foto não pôde ser aberta. Escolha outro arquivo.');
    };
    photo.onerror = () => { if (active) setError('Esta foto não pôde ser aberta. Escolha outro arquivo.'); };
    photo.src = url;
    return () => { active = false; URL.revokeObjectURL(url); };
  }, [file]);

  const crop = image ? getSquareImageCrop(image.naturalWidth, image.naturalHeight, position) : null;
  const updatePosition = (key: keyof ImageCropPosition, value: number) => setPosition((current) => ({ ...current, [key]: value }));
  const movePhoto = (event: PointerEvent<HTMLDivElement>) => {
    const start = drag.current;
    if (!start || start.id !== event.pointerId || !image || saving) return;
    const initialCrop = getSquareImageCrop(image.naturalWidth, image.naturalHeight, start.position);
    const width = event.currentTarget.getBoundingClientRect().width;
    if (!width) return;
    const dx = (event.clientX - start.x) * initialCrop.size / width;
    const dy = (event.clientY - start.y) * initialCrop.size / width;
    setPosition({
      ...start.position,
      x: clampCropPosition(start.position.x - dx / (image.naturalWidth - initialCrop.size || 1)),
      y: clampCropPosition(start.position.y - dy / (image.naturalHeight - initialCrop.size || 1)),
    });
  };

  const confirm = async () => {
    if (!image || !crop || saving) return;
    setSaving(true);
    setError('');
    try {
      await onConfirm(await cropImageFile(image, file, crop));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível salvar a foto. Tente novamente.');
    } finally { setSaving(false); }
  };

  return (
    <DialogShell
      isOpen
      onClose={() => { if (!saving) onCancel(); }}
      title="Ajustar foto"
      description="Escolha o enquadramento que aparecerá no perfil público."
      descriptionPlacement="visible"
      size="form"
      closeOnOverlay={!saving}
      closeOnEscape={!saving}
      showCloseButton={!saving}
      footer={<><Button variant="secondary" onClick={onCancel} disabled={saving}>Cancelar</Button><Button onClick={() => void confirm()} disabled={!image} loading={saving}>Usar este recorte</Button></>}
    >
      <div className="kds-image-crop">
        <Text id={instructionsId} size="sm" tone="muted">Arraste a foto ou use os controles abaixo para ajustar o corte. As setas do teclado também movem a foto.</Text>
        <div
          className="kds-image-crop-frame"
          role="group"
          aria-label="Prévia do recorte da foto"
          aria-describedby={instructionsId}
          tabIndex={image && !saving ? 0 : -1}
          onPointerDown={(event) => {
            if (!image || saving || event.button !== 0) return;
            event.currentTarget.setPointerCapture(event.pointerId);
            drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, position };
          }}
          onPointerMove={movePhoto}
          onPointerUp={() => { drag.current = null; }}
          onPointerCancel={() => { drag.current = null; }}
          onLostPointerCapture={() => { drag.current = null; }}
          onKeyDown={(event) => {
            if (saving || !image) return;
            const directions: Record<string, [number, number]> = { ArrowLeft: [0.02, 0], ArrowRight: [-0.02, 0], ArrowUp: [0, 0.02], ArrowDown: [0, -0.02] };
            const direction = directions[event.key];
            if (!direction) return;
            event.preventDefault();
            setPosition((current) => ({ ...current, x: clampCropPosition(current.x + direction[0]), y: clampCropPosition(current.y + direction[1]) }));
          }}
        >
          {image && crop ? <img
            src={image.src}
            alt="Enquadramento da foto do perfil"
            draggable={false}
            style={{ width: `${image.naturalWidth / crop.size * 100}%`, height: `${image.naturalHeight / crop.size * 100}%`, left: `${-crop.x / crop.size * 100}%`, top: `${-crop.y / crop.size * 100}%` }}
          /> : <Text size="sm">{error ? 'Foto indisponível' : 'Preparando foto…'}</Text>}
        </div>
        <Field label="Zoom" disabled={!image || saving}><Slider min={1} max={3} step={0.01} value={position.zoom} aria-valuetext={`${Math.round(position.zoom * 100)}%`} onChange={(event) => updatePosition('zoom', Number(event.target.value))} /></Field>
        <div className="kds-image-crop-position">
          <Field label="Posição horizontal" disabled={!image || saving || image.naturalWidth === crop?.size}><Slider min={0} max={100} step={1} value={Math.round(position.x * 100)} onChange={(event) => updatePosition('x', Number(event.target.value) / 100)} /></Field>
          <Field label="Posição vertical" disabled={!image || saving || image.naturalHeight === crop?.size}><Slider min={0} max={100} step={1} value={Math.round(position.y * 100)} onChange={(event) => updatePosition('y', Number(event.target.value) / 100)} /></Field>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setPosition(centered)} disabled={!image || saving}>Centralizar foto</Button>
        {file.type === 'image/gif' && <Text size="sm" tone="muted">O recorte do GIF será salvo como foto estática.</Text>}
        {error && <Alert tone="danger" role="alert">{error}</Alert>}
      </div>
    </DialogShell>
  );
}
