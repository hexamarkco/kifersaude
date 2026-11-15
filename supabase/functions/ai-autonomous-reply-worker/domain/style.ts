import { FIELDS, isRecord, type Field } from './state.ts';
import type { Decision } from './decision.ts';

/** Reviewed, anonymized examples. Historical client data must never become current facts. */
export type StyleExample = { id: string; field: Field; text: string; audience: 'individual' | 'family' | 'any' };
export type StyleLibrary = { version: string; examples: StyleExample[] };
export type StyleTrace = { libraryVersion: string | null; referenceIds: string[] };

export function readStyleLibrary(value: unknown): StyleLibrary {
  if (!isRecord(value) || typeof value.version !== 'string' || value.version.length > 80
    || !Array.isArray(value.examples) || value.examples.length > 200) throw new Error('Base de estilo inválida.');
  const seen = new Set<string>();
  const examples: StyleExample[] = value.examples.map((item: unknown) => {
    if (!isRecord(item) || typeof item.id !== 'string' || !/^style-[a-f0-9]{12}$/.test(item.id) || seen.has(item.id)
      || !FIELDS.includes(item.field as Field) || typeof item.text !== 'string' || item.text.length < 10 || item.text.length > 480
      || !['individual', 'family', 'any'].includes(String(item.audience))) throw new Error('Exemplo de estilo inválido.');
    seen.add(item.id);
    return { id: item.id, field: item.field as Field, text: item.text, audience: item.audience as StyleExample['audience'] };
  });
  return { version: value.version, examples };
}

/** Small topic lookup, with no external request, embeddings, or extra model invocation. */
export function selectStyleExamples(library: StyleLibrary | undefined, decision: Decision, count: number | null,
  recentReplies: readonly string[]): StyleExample[] {
  if (!library || !decision.field || !['ask', 'clarify'].includes(decision.action)) return [];
  const audience = count === null ? 'any' : count === 1 ? 'individual' : 'family';
  const opening = (text: string) => text.toLowerCase().replace(/[!,.?].*$/s, '').trim();
  const recentOpenings = new Set(recentReplies.slice(-2).map(opening));
  return library.examples.filter((example) => example.field === decision.field
    && (example.audience === 'any' || audience === 'any' || example.audience === audience))
    .map((example, index) => ({ example, index, score: (example.audience === audience ? 2 : 0)
      - (recentOpenings.has(opening(example.text)) ? 3 : 0) }))
    .sort((a, b) => b.score - a.score || a.index - b.index).slice(0, 3).map(({ example }) => example);
}
