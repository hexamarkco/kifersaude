export type ImageCropPosition = { x: number; y: number; zoom: number };
export type ImageCropRect = { x: number; y: number; size: number };

const IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
export const clampCropPosition = (value: number) => Math.min(1, Math.max(0, value));

export function getImageFileError(file: File): string | null {
  if (!IMAGE_TYPES.includes(file.type)) return 'Escolha uma foto em JPG, PNG, WEBP ou GIF.';
  if (file.size > 5 * 1024 * 1024) return 'A foto deve ter até 5 MB. Escolha um arquivo menor.';
  return null;
}

/** Coordinates in the original image, shared by the preview and the exported photo. */
export function getSquareImageCrop(width: number, height: number, position: ImageCropPosition): ImageCropRect {
  const size = Math.min(width, height) / Math.min(3, Math.max(1, position.zoom));
  return {
    x: (width - size) * clampCropPosition(position.x),
    y: (height - size) * clampCropPosition(position.y),
    size,
  };
}

export async function cropImageFile(image: HTMLImageElement, file: File, crop: ImageCropRect): Promise<File> {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = Math.max(1, Math.min(1024, Math.round(crop.size)));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Não foi possível preparar o recorte. Tente usar outro navegador.');
  context.drawImage(image, crop.x, crop.y, crop.size, crop.size, 0, 0, canvas.width, canvas.height);
  const isJpeg = file.type === 'image/jpeg' || file.type === 'image/jpg';
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((result) => {
      if (result) resolve(result);
      else reject(new Error('Não foi possível recortar a foto. Tente novamente.'));
    }, isJpeg ? 'image/jpeg' : 'image/png', 0.92);
  });
  return new File([blob], `${file.name.replace(/\.[^.]+$/, '')}-recorte.${isJpeg ? 'jpg' : 'png'}`, { type: blob.type });
}
