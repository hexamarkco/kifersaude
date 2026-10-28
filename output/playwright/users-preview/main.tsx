import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import ConfigPageScreen from '../../../src/features/config/ConfigPageScreen';
import '../../../src/index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <div className="painel-theme kifer-ds min-h-screen bg-[var(--bg-canvas)] px-4 py-5 sm:px-8 lg:px-12">
        <div className="mx-auto w-full max-w-[1600px]">
          <ConfigPageScreen />
        </div>
      </div>
    </BrowserRouter>
  </StrictMode>,
);
