export type PublicConversionEvent =
  | 'operator_landing_cta_click'
  | 'public_quote_started'
  | 'public_whatsapp_click';

export type PublicConversionParameters = Record<string, string | number | boolean | undefined>;

type AnalyticsWindow = Window & {
  dataLayer?: Array<Record<string, unknown>>;
  gtag?: (command: 'event', eventName: string, parameters: PublicConversionParameters) => void;
};

export function trackPublicConversion(eventName: PublicConversionEvent, parameters: PublicConversionParameters = {}): void {
  if (typeof window === 'undefined') {
    return;
  }

  const analyticsWindow = window as AnalyticsWindow;
  const payload = { event: eventName, ...parameters };

  analyticsWindow.dataLayer?.push(payload);
  analyticsWindow.gtag?.('event', eventName, parameters);
  window.dispatchEvent(new CustomEvent('kifer:public-conversion', { detail: payload }));
}
