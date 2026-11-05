import {
  zapiOperations, type ZapiJson, type ZapiOperation, type ZapiOperationDefinition, type ZapiSchema,
} from './zapi-operation-contract.ts';
import { zapiNativeId, zapiPhone, zapiRecord, zapiString } from './zapi.ts';

export class ZapiInputError extends Error {
  readonly status = 400;
}

export function getZapiOperation(value: unknown): { operation: ZapiOperation; definition: ZapiOperationDefinition } {
  if (typeof value !== 'string' || !Object.hasOwn(zapiOperations, value)) {
    throw new ZapiInputError('Escolha uma operação disponível do WhatsApp.');
  }
  const operation = value as ZapiOperation;
  return { operation, definition: zapiOperations[operation] };
}

/** Validate recursively; reject unknown properties rather than forwarding arbitrary JSON. */
export function validateZapiInput(schema: ZapiSchema, input: unknown, path = 'Dados'): ZapiJson {
  const invalid = () => new ZapiInputError(`Confira o campo ${path}.`);
  if (schema.type === 'object') {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw invalid();
    const data = input as Record<string, unknown>;
    const properties = schema.properties ?? {};
    if (Object.keys(data).some((key) => !Object.hasOwn(properties, key))) throw invalid();
    const result: Record<string, ZapiJson> = {};
    for (const [key, child] of Object.entries(properties)) {
      if (!Object.hasOwn(data, key) || data[key] === undefined) {
        if (child.required) throw new ZapiInputError(`Preencha ${child.label || key}.`);
      } else {
        result[key] = validateZapiInput(child, data[key], child.label || key);
      }
    }
    return result;
  }
  if (schema.type === 'array') {
    if (!Array.isArray(input) || input.length > 1000 || (schema.required && input.length === 0) || !schema.items) throw invalid();
    return input.map((item) => validateZapiInput(schema.items!, item, path));
  }
  if (schema.type === 'number') {
    if (typeof input !== 'number' || !Number.isFinite(input) || input < (schema.minimum ?? -Infinity)) throw invalid();
    return input;
  }
  if (schema.type === 'boolean') {
    if (typeof input !== 'boolean') throw invalid();
    return input;
  }
  if (typeof input !== 'string' || input.length > 45 * 1024 * 1024 ||
      (schema.enum && !schema.enum.includes(input))) throw invalid();
  if (schema.required && !input.trim() && !/descrição|legenda/i.test(schema.label ?? '')) throw invalid();
  return input;
}

export function isZapiDirectPhone(value: string): boolean {
  return Boolean(zapiPhone(value));
}

export function validateZapiRecipient(value: string): string {
  if (isZapiDirectPhone(value) || /^\d+(?:-\d+)?-group$/.test(value) || /^\d+@(newsletter|broadcast)$/.test(value)) return value;
  throw new ZapiInputError('Informe um telefone com DDI ou um identificador válido de grupo, canal ou lista.');
}

function normalizeIdentifiers(value: ZapiJson, instanceId: string): ZapiJson {
  if (Array.isArray(value)) return value.map((item) => normalizeIdentifiers(item, instanceId));
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, child]) => {
    if (/messageId$/i.test(key) && typeof child === 'string' && child.startsWith('zapi:')) {
      const native = zapiNativeId(instanceId, child);
      if (!native) throw new ZapiInputError('A mensagem deve pertencer à instância Z-API ativa.');
      return [key, native];
    }
    return [key, normalizeIdentifiers(child, instanceId)];
  }));
}

export function prepareZapiOperation(operation: unknown, input: unknown, instanceId: string) {
  const selected = getZapiOperation(operation);
  const value = normalizeIdentifiers(validateZapiInput(selected.definition.input, input), instanceId);
  const data = value as Record<string, ZapiJson>;
  // API identifiers are kept distinct: LIDs are never guessed to be phones.
  if (typeof data.phone === 'string') validateZapiRecipient(data.phone);
  for (const key of ['messagePhone', 'contactPhone', 'catalogPhone']) {
    if (typeof data[key] === 'string') validateZapiRecipient(data[key]);
  }
  if (Array.isArray(data.phones) && data.phones.some((phone) => typeof phone !== 'string' || !isZapiDirectPhone(phone))) {
    throw new ZapiInputError('Confira os telefones com DDI.');
  }
  if (Array.isArray(data.contacts) && data.contacts.some((contact) => {
    const entry = zapiRecord(contact);
    return selected.operation === 'contacts/add-contacts'
      ? !isZapiDirectPhone(zapiString(entry.phone))
      : !Array.isArray(entry.phones) || !entry.phones.length || entry.phones.some((phone) => !isZapiDirectPhone(zapiString(phone)));
  })) {
    throw new ZapiInputError('Confira os telefones dos contatos com DDI.');
  }
  for (const key of ['page', 'pageSize']) {
    if (data[key] !== undefined && (typeof data[key] !== 'number' || !Number.isInteger(data[key]) || data[key] < 1)) {
      throw new ZapiInputError('Informe uma página e uma quantidade válidas.');
    }
  }
  for (const key of ['delayMessage', 'delayTyping']) {
    if (data[key] !== undefined && (typeof data[key] !== 'number' || data[key] < 1 || data[key] > 15)) {
      throw new ZapiInputError('O intervalo deve ficar entre 1 e 15 segundos.');
    }
  }
  let path = selected.definition.path.replace(/\{([^}]+)\}/g, (_match, key: string) => {
    const part = data[key];
    if (typeof part !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9@._-]{0,255}$/.test(part)) {
      throw new ZapiInputError('Confira o identificador informado.');
    }
    return encodeURIComponent(part);
  });
  const query = new URLSearchParams();
  const body: Record<string, ZapiJson> = {};
  for (const [key, field] of Object.entries(data)) {
    if (selected.definition.pathFields.includes(key)) continue;
    if (selected.definition.queryFields.includes(key)) {
      if (typeof field !== 'string' && typeof field !== 'number' && typeof field !== 'boolean') throw new ZapiInputError('Confira os filtros.');
      query.set(key, String(field));
    } else body[key] = field;
  }
  if (query.size) path += `?${query}`;
  return { ...selected, data, path, body: selected.definition.bodyField ? data[selected.definition.bodyField] : Object.keys(body).length ? body : undefined };
}

/** Canonical fingerprint detects reuse of a request identifier with different content. */
export function canonicalZapiInput(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalZapiInput).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalZapiInput((value as Record<string, unknown>)[key])}`).join(',')}}`;
  return JSON.stringify(value);
}

export function zapiMessageSummary(operation: ZapiOperation, input: Record<string, ZapiJson>): string {
  const text = zapiString(input.message) || zapiString(input.caption);
  return text || `[${zapiOperations[operation].label}]`;
}

