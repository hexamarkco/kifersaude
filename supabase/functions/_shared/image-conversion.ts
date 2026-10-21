import {
  ImageMagick,
  initializeImageMagick,
  MagickFormat,
} from 'npm:@imagemagick/magick-wasm@0.0.44';

let imageMagickInitialization: Promise<void> | null = null;

const initializeImageMagickOnce = () => {
  if (!imageMagickInitialization) {
    const wasmUrl = new URL(import.meta.resolve('npm:@imagemagick/magick-wasm@0.0.44/magick.wasm'));
    imageMagickInitialization = Deno.readFile(wasmUrl).then(initializeImageMagick);
  }
  return imageMagickInitialization;
};

export async function convertAvifToJpeg(file: File): Promise<File> {
  await initializeImageMagickOnce();
  const sourceBytes = new Uint8Array(await file.arrayBuffer());
  const jpegBytes = ImageMagick.read(sourceBytes, (image) => {
    image.autoOrient();
    return image.write(MagickFormat.Jpeg, (bytes) => new Uint8Array(bytes));
  });

  if (!(jpegBytes instanceof Uint8Array) || jpegBytes.length === 0) {
    throw new Error('Não foi possível converter a imagem AVIF para JPEG.');
  }

  const fileName = file.name.replace(/\.avif$/i, '') || 'imagem';
  return new File([jpegBytes], `${fileName}.jpg`, {
    type: 'image/jpeg',
    lastModified: file.lastModified,
  });
}
