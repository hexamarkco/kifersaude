import { Button, Field, Input, Select, Text } from '../../../../design-system';
import type { ZapiJson, ZapiSchema } from '../domain/zapiOperationContract.generated';
import { useProviderMediaInput } from '../hooks/useProviderMediaInput';
import { providerChoiceLabel } from '../domain/providerOperationPresentation';

type Props = { schema: ZapiSchema; value: ZapiJson | undefined; onChange(value: ZapiJson | undefined): void; path?: string; disabled?: boolean };

function MediaField({ schema, value, onChange, path, disabled }: Props) {
  const media = useProviderMediaInput(onChange);
  const uploaded = typeof value === 'string' && value.startsWith('data:');
  return <Field label={schema.label} htmlFor={path} required={schema.required} error={media.error ?? undefined}>
    <div className="space-y-2">
      <Input id={path} type="url" placeholder="Endereço do arquivo na internet" disabled={disabled || media.loading}
        required={schema.required && !uploaded} value={typeof value === 'string' && !uploaded ? value : ''}
        onChange={(event) => onChange(event.target.value || undefined)} />
      <Input type="file" aria-label={`Escolher ${schema.label?.toLocaleLowerCase('pt-BR')}`} accept={schema.accept}
        disabled={disabled || media.loading} onChange={(event) => media.select(event.target.files?.[0])} />
      {uploaded && <Text className="text-sm text-[var(--text-secondary)]">Arquivo preparado: {media.name || 'arquivo selecionado'}</Text>}
      {media.loading && <Text role="status">Preparando arquivo…</Text>}
    </div>
  </Field>;
}

/** Structured forms keep nested buttons, polls and recipients out of JSON editors. */
export function WhatsAppOperationFields({ schema, value, onChange, path = 'operation', disabled }: Props) {
  if (schema.format === 'media') return <MediaField schema={schema} value={value} onChange={onChange} path={path} disabled={disabled} />;
  if (schema.type === 'object') {
    const object = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    return <div className="space-y-3">{Object.entries(schema.properties ?? {}).map(([key, child]) => {
      const childValue = object[key];
      const update = (next: ZapiJson | undefined) => {
        const result = { ...object };
        if (next === undefined) delete result[key]; else result[key] = next;
        onChange(result);
      };
      if (child.type === 'object' || child.type === 'array') {
        return <fieldset className="space-y-3 rounded-lg border border-[var(--border-subtle)] p-3" key={key} disabled={disabled}>
          <legend className="px-1 text-sm font-medium">{child.label}{child.required ? ' *' : ''}</legend>
          {!child.required && childValue === undefined
            ? <Button type="button" variant="secondary" onClick={() => update(child.type === 'array' ? [] : {})}>Adicionar {child.label?.toLocaleLowerCase('pt-BR')}</Button>
            : <><WhatsAppOperationFields schema={child} value={childValue} onChange={update} path={`${path}-${key}`} disabled={disabled} />
              {!child.required && <Button type="button" variant="ghost" onClick={() => update(undefined)}>Não informar {child.label?.toLocaleLowerCase('pt-BR')}</Button>}</>}
        </fieldset>;
      }
      return <WhatsAppOperationFields key={key} schema={child} value={childValue} onChange={update} path={`${path}-${key}`} disabled={disabled} />;
    })}</div>;
  }
  if (schema.type === 'array') {
    const array = Array.isArray(value) ? value : [];
    const item = schema.items;
    if (!item) return null;
    return <div className="space-y-3">
      {array.map((entry, index) => <div className="space-y-2 border-b border-[var(--border-subtle)] pb-3" key={index}>
        <WhatsAppOperationFields schema={{ ...item, label: item.label || `Item ${index + 1}`, required: true }} value={entry} path={`${path}-${index}`} disabled={disabled}
          onChange={(next) => onChange(array.map((old, position) => position === index ? next ?? '' : old))} />
        <Button type="button" variant="ghost" disabled={disabled} onClick={() => onChange(array.filter((_, position) => position !== index))}>Remover item {index + 1}</Button>
      </div>)}
      <Button type="button" variant="secondary" disabled={disabled || array.length >= 1000} onClick={() => onChange([...array, item.type === 'object' ? {} : item.type === 'boolean' ? false : ''])}>Adicionar item</Button>
      {schema.required && !array.length && <Text className="text-sm text-[var(--text-secondary)]">Adicione pelo menos um item antes de continuar.</Text>}
    </div>;
  }
  if (schema.type === 'boolean' || schema.enum) {
    return <Field label={schema.label} required={schema.required}>
      <Select id={path} disabled={disabled} value={value === undefined ? '' : String(value)} required={schema.required}
        onChange={(event) => onChange(event.target.value === '' ? undefined : schema.type === 'boolean' ? event.target.value === 'true' : event.target.value)}
        options={[{ value: '', label: schema.required ? 'Selecione' : 'Não informar' },
          ...(schema.type === 'boolean' ? [{ value: 'true', label: 'Sim' }, { value: 'false', label: 'Não' }]
            : schema.enum?.map((entry) => ({ value: entry, label: providerChoiceLabel(entry) })) ?? [])]} />
    </Field>;
  }
  return <Field label={schema.label} required={schema.required}>
    <Input id={path} disabled={disabled} required={schema.required} type={schema.type === 'number' ? 'number' : 'text'}
      min={schema.minimum} step="any" value={typeof value === 'string' || typeof value === 'number' ? value : ''}
      onChange={(event) => onChange(event.target.value === '' && !schema.required ? undefined : schema.type === 'number' && event.target.value !== '' ? Number(event.target.value) : event.target.value)} />
  </Field>;
}
