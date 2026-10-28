import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cx } from '../../lib/cx';

export type DropdownOptionProps = ButtonHTMLAttributes<HTMLButtonElement>;
/** Shared selectable row. The parent menu coordinates selection and keyboard navigation. */
const DropdownOption = forwardRef<HTMLButtonElement, DropdownOptionProps>(function DropdownOption({ className, type = 'button', role = 'option', onKeyDown, ...props }, ref) {
  return <button ref={ref} type={type} role={role} className={cx('kds-dropdown-option', className)} {...props} onKeyDown={(event) => {
    onKeyDown?.(event);
    if (event.defaultPrevented || !['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
    const options = Array.from(event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>(`:scope > button[role="${event.currentTarget.getAttribute('role')}"]:not(:disabled)`) ?? []);
    if (!options.length) return;
    const current = options.indexOf(event.currentTarget);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1 : (current + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length;
    event.preventDefault();
    options[next].focus();
  }} />;
});
export default DropdownOption;
