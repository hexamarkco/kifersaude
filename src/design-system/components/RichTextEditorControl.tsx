import { forwardRef } from 'react';
import ReactQuill, { type ReactQuillProps } from 'react-quill';
import { cx } from '../../lib/cx';

export type RichTextEditorProps = ReactQuillProps;
/** Owns editor appearance; content, toolbars and persistence remain controlled by its consumer. */
const RichTextEditor = forwardRef<ReactQuill, RichTextEditorProps>(function RichTextEditor({ className, theme = 'snow', ...props }, ref) {
  return <ReactQuill ref={ref} theme={theme} {...props} className={cx('kds-rich-text-editor', 'kds-blog-editor', className)} />;
});
export default RichTextEditor;
