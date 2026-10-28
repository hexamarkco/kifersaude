import { createRoot } from 'react-dom/client';
import FormsScreen from '../../../src/features/config/forms/FormsScreen';
import '../../../src/index.css';
createRoot(document.getElementById('root')!).render(<div className="painel-theme kifer-ds min-h-screen bg-[var(--bg-canvas)] px-4 py-5 sm:px-8 lg:px-12"><FormsScreen /></div>);
