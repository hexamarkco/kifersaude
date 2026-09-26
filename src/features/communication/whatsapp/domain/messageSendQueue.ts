/**
 * An ambiguous send may still have reached WhatsApp, so the next queued item
 * can continue without risking a visible gap caused by a duplicate retry.
 * A definitive failure must stop the remaining segments to preserve order.
 */
export const shouldContinueQueuedTextSendAfterFailure = (isAmbiguous: boolean) => isAmbiguous;

export const QUEUED_TEXT_SEND_INTERRUPTED_MESSAGE =
  'Envio interrompido antes deste trecho. Toque em reenviar para tentar novamente.';
