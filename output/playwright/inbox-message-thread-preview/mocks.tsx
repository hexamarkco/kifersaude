import type { CommWhatsAppMessage } from '../../../src/features/communication/whatsapp/domain/types';

export const DeliveryStatusIndicator = () => null;
export const RetryMediaButton = () => null;
export const WhatsAppMediaGroupBody = () => <div className="preview-media-placeholder" aria-label="Mídia de demonstração" />;

export const WhatsAppMessageBody = ({ message }: { message: CommWhatsAppMessage }) => (
  <div className="whatsapp-inbox-image-card preview-message-media" aria-label="Imagem recebida de demonstração">
    {message.media_url ? <img src={message.media_url} alt="Imagem de demonstração" /> : null}
  </div>
);
