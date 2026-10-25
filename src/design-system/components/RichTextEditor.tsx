import { forwardRef, lazy, Suspense } from 'react';
import type ReactQuill from 'react-quill';
import type { ReactQuillProps } from 'react-quill';
import { LoadingState } from './LoadingState';

const Editor = lazy(() => import('./RichTextEditorControl'));
export type RichTextEditorProps = ReactQuillProps;
const RichTextEditor = forwardRef<ReactQuill, RichTextEditorProps>(function RichTextEditor(props, ref) {
  return <Suspense fallback={<LoadingState compact label="Carregando editor" />}><Editor {...props} ref={ref} /></Suspense>;
});
export default RichTextEditor;
