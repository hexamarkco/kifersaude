import { createRoot } from 'react-dom/client';
import { WhatsAppAudioPlayerCard } from '../../../src/features/communication/whatsapp/components/WhatsAppMessageContent';
import '../../../src/index.css';

function AudioPreview() {
  return (
    <main className="painel-theme kifer-ds kifer-panel-theme theme-dark comm-terracotta" style={{ minHeight: '100vh', padding: '16px', background: 'var(--bg-canvas)', color: 'var(--text-primary)', fontFamily: 'var(--font-sans)' }}>
      <h1 className="mb-4 text-base font-semibold">Prévia do player em espaço compacto</h1>
      <div style={{ width: 'min(260px, calc(100vw - 32px))' }}>
        <WhatsAppAudioPlayerCard
          kind="voice"
          mediaUrl="data:audio/wav;base64,"
          durationSeconds={23}
          canTranscribe
          hasTranscription
          transcriptionStatus="completed"
          transcribing={false}
          onTranscribe={() => undefined}
          loading={false}
          error={null}
          mediaSending={false}
          mediaSendingProgress={null}
        />
      </div>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(<AudioPreview />);
