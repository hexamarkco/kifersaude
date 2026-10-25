import { forwardRef, type LabelHTMLAttributes } from 'react';
import { cx } from '../../lib/cx';

export type FieldLabelProps = LabelHTMLAttributes<HTMLLabelElement>;
const FieldLabel = forwardRef<HTMLLabelElement, FieldLabelProps>(function FieldLabel({ className, ...props }, ref) {
  return <label ref={ref} className={cx('kds-field-label', className)} {...props} />;
});
export default FieldLabel;
