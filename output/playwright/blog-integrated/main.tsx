import { createRoot } from 'react-dom/client';
import { AuthProvider } from '../../../src/contexts/AuthContext';
import BlogTabScreen from '../../../src/features/blog/BlogTabScreen';
import ToastViewport from '../../../src/components/ui/ToastViewport';
import '../../../src/index.css';
createRoot(document.getElementById('root')!).render(<AuthProvider><div className="painel-theme kifer-ds min-h-screen bg-[var(--bg-canvas)] px-4 py-5 sm:px-8 lg:px-12"><BlogTabScreen /><ToastViewport /></div></AuthProvider>);
