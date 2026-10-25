import { forwardRef, type InputHTMLAttributes } from 'react';
import { cx } from '../../lib/cx';

export type SliderProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'>;
const Slider = forwardRef<HTMLInputElement, SliderProps>(function Slider({ className, ...props }, ref) {
  return <input ref={ref} type="range" className={cx('kds-slider', className)} {...props} />;
});
export default Slider;
