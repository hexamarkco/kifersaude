import { zapiRecord, zapiString } from './zapi.ts';

const names = (value: unknown): string => Array.isArray(value)
  ? value.map((item) => zapiString(zapiRecord(item).name)).filter(Boolean).join(', ') : '';

/** Real interactive replies must reach the commercial transcript and stop-on-reply rules. */
export function zapiRichContentText(payload: Record<string, unknown>): string {
  const button = zapiRecord(payload.buttonsResponseMessage);
  if (zapiString(button.message)) return zapiString(button.message);
  const list = zapiRecord(payload.listResponseMessage);
  const listText = [...new Set([zapiString(list.title), zapiString(list.message)].filter(Boolean))].join(' — ');
  if (listText) return listText;
  const vote = names(zapiRecord(payload.pollVote).options);
  if (vote) return `Voto na enquete: ${vote}`;
  const eventResponse = zapiString(zapiRecord(payload.eventResponse).response);
  if (eventResponse === 'GOING') return 'Resposta ao evento: vou participar.';
  if (eventResponse === 'NOT_GOING') return 'Resposta ao evento: não vou participar.';
  for (const key of ['buttonsMessage', 'hydratedTemplate', 'carouselMessage']) {
    const data = zapiRecord(payload[key]);
    const text = zapiString(data.message) || zapiString(data.text);
    if (text) return text;
  }
  const poll = zapiRecord(payload.poll);
  if (zapiString(poll.question)) return `${zapiString(poll.question)}${names(poll.options) ? `\nOpções: ${names(poll.options)}` : ''}`;
  const product = zapiRecord(payload.product);
  if (zapiString(product.title)) return `Produto: ${zapiString(product.title)}`;
  const order = zapiRecord(payload.order);
  if (zapiString(order.orderTitle) || zapiString(order.message)) return `Pedido: ${zapiString(order.orderTitle) || zapiString(order.message)}`;
  const review = zapiRecord(payload.reviewOrder ?? payload.reviewAndPay);
  if (zapiString(review.orderStatus) || zapiString(review.paymentStatus)) return '[Atualização de pedido ou pagamento recebida]';
  const event = zapiRecord(payload.event);
  if (zapiString(event.name)) return `Evento: ${zapiString(event.name)}${zapiString(event.description) ? `\n${zapiString(event.description)}` : ''}`;
  return '';
}
