import { forwardRef, type InputHTMLAttributes } from 'react';
import { cx } from '../../lib/cx';

export type FileInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'>;

/** Native selection also supports hidden inputs activated by an associated label. */
const FileInput = forwardRef<HTMLInputElement, FileInputProps>(function FileInput({ className, ...props }, ref) {
  return <input ref={ref} type="file" className={cx('kds-file-input', className)} {...props} />;
});
export default FileInput;
