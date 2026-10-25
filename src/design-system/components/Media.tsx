import { forwardRef, type AudioHTMLAttributes, type ImgHTMLAttributes, type VideoHTMLAttributes } from 'react';
import { cx } from '../../lib/cx';

export type ImageProps = ImgHTMLAttributes<HTMLImageElement> & { fit?: 'contain' | 'cover'; radius?: 'none' | 'control' | 'panel' | 'full' };
export const Image = forwardRef<HTMLImageElement, ImageProps>(function Image({ className, decoding = 'async', fit, radius = 'none', ...props }, ref) {
  return <img ref={ref} decoding={decoding} className={cx('kds-image', fit && `kds-image-${fit}`, `kds-image-radius-${radius}`, className)} {...props} />;
});

export const Video = forwardRef<HTMLVideoElement, VideoHTMLAttributes<HTMLVideoElement>>(function Video({ className, ...props }, ref) {
  return <video ref={ref} className={cx('kds-video', className)} {...props} />;
});
export const Audio = forwardRef<HTMLAudioElement, AudioHTMLAttributes<HTMLAudioElement>>(function Audio({ className, ...props }, ref) {
  return <audio ref={ref} className={cx('kds-audio', className)} {...props} />;
});
