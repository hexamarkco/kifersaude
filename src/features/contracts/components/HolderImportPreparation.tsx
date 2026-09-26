import { useRef, useState, type FormEvent } from 'react';
import { Clipboard, ClipboardCheck, FilePlus2 } from 'lucide-react';

import {
  Button,
  Dialog,
  DialogBody,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  Input,
  Surface,
} from '../../../design-system';
import { createContractHolderImport } from '../data/holderImportRepository';
import type {
  ContractHolderImportPayload,
  ContractHolderImportResult,
} from '../domain/holderImport';
import type { Contract } from '../domain/types';

type HolderImportFormState = {
  nome_completo: string;
  cpf: string;
  rg: string;
  data_nascimento: string;
  sexo: string;
  estado_civil: string;
  telefone: string;
  email: string;
  cep: string;
  endereco: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  estado: string;
  cns: string;
  cnpj: string;
  razao_social: string;
  nome_fantasia: string;
  percentual_societario: string;
  data_abertura_cnpj: string;
};

const emptyForm = (): HolderImportFormState => ({
  nome_completo: '',
  cpf: '',
  rg: '',
  data_nascimento: '',
  sexo: '',
  estado_civil: '',
  telefone: '',
  email: '',
  cep: '',
  endereco: '',
  numero: '',
  complemento: '',
  bairro: '',
  cidade: '',
  estado: '',
  cns: '',
  cnpj: '',
  razao_social: '',
  nome_fantasia: '',
  percentual_societario: '',
  data_abertura_cnpj: '',
});

const personalFields: Array<{
  key: keyof HolderImportFormState;
  label: string;
  type?: string;
  required?: boolean;
  autoFormat?: 'cep' | 'cns' | 'cpf' | 'cnpj' | 'phone';
}> = [
  { key: 'nome_completo', label: 'Nome completo', required: true },
  { key: 'cpf', label: 'CPF', required: true, autoFormat: 'cpf' },
  { key: 'rg', label: 'RG' },
  { key: 'data_nascimento', label: 'Data de nascimento', type: 'date', required: true },
  { key: 'sexo', label: 'Sexo' },
  { key: 'estado_civil', label: 'Estado civil' },
  { key: 'telefone', label: 'Telefone', type: 'tel', required: true, autoFormat: 'phone' },
  { key: 'email', label: 'E-mail', type: 'email' },
  { key: 'cns', label: 'CNS', autoFormat: 'cns' },
];

const addressFields: Array<{
  key: keyof HolderImportFormState;
  label: string;
  autoFormat?: 'cep' | 'cns' | 'cpf' | 'cnpj' | 'phone';
}> = [
  { key: 'cep', label: 'CEP', autoFormat: 'cep' },
  { key: 'endereco', label: 'Endereço' },
  { key: 'numero', label: 'Número' },
  { key: 'complemento', label: 'Complemento' },
  { key: 'bairro', label: 'Bairro' },
  { key: 'cidade', label: 'Cidade' },
  { key: 'estado', label: 'Estado' },
];

const companyFields: Array<{
  key: keyof HolderImportFormState;
  label: string;
  type?: string;
  autoFormat?: 'cep' | 'cns' | 'cpf' | 'cnpj' | 'phone';
}> = [
  { key: 'cnpj', label: 'CNPJ', autoFormat: 'cnpj' },
  { key: 'razao_social', label: 'Razão social' },
  { key: 'nome_fantasia', label: 'Nome fantasia' },
  { key: 'percentual_societario', label: 'Percentual societário', type: 'number' },
  { key: 'data_abertura_cnpj', label: 'Data de abertura do CNPJ', type: 'date' },
];

const optionalString = (value: string) => value.trim() || undefined;

const toHolderPayload = (
  form: HolderImportFormState,
  bonusPorVidaAplicado: boolean,
): ContractHolderImportPayload => ({
  nome_completo: form.nome_completo.trim(),
  cpf: form.cpf.trim(),
  data_nascimento: form.data_nascimento,
  telefone: form.telefone.trim(),
  ...Object.fromEntries(
    ['rg', 'sexo', 'estado_civil', 'email', 'cep', 'endereco', 'numero', 'complemento', 'bairro', 'cidade', 'estado', 'cns', 'cnpj', 'razao_social', 'nome_fantasia']
      .flatMap((key) => {
        const value = optionalString(form[key as keyof HolderImportFormState]);
        return value ? [[key, value]] : [];
      }),
  ),
  ...(form.percentual_societario.trim()
    ? { percentual_societario: Number(form.percentual_societario) }
    : {}),
  ...(form.data_abertura_cnpj ? { data_abertura_cnpj: form.data_abertura_cnpj } : {}),
  bonus_por_vida_aplicado: bonusPorVidaAplicado,
});

const formatExpiration = (value: string) => new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short',
}).format(new Date(value));

export default function HolderImportPreparation({ contract }: { contract: Contract }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<HolderImportFormState>(emptyForm);
  const [result, setResult] = useState<ContractHolderImportResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const idempotencyKeyRef = useRef<string | null>(null);

  const close = () => {
    setOpen(false);
    setForm(emptyForm());
    setResult(null);
    setErrorMessage(null);
    setCopied(false);
    idempotencyKeyRef.current = null;
  };

  const updateForm = (key: keyof HolderImportFormState, value: string) => {
    idempotencyKeyRef.current = null;
    setForm((current) => ({ ...current, [key]: value }));
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setErrorMessage(null);
    try {
      idempotencyKeyRef.current ??= crypto.randomUUID();
      const created = await createContractHolderImport({
        contract_id: contract.id,
        lead_id: contract.lead_id || null,
        holder: toHolderPayload(form, contract.bonus_por_vida_aplicado ?? true),
      }, idempotencyKeyRef.current);
      setResult(created);
      setForm(emptyForm());
      idempotencyKeyRef.current = null;
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Não foi possível preparar o titular para importação.');
    } finally {
      setSaving(false);
    }
  };

  const copyImportId = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.import_id);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const renderFields = (fields: Array<{
    key: keyof HolderImportFormState;
    label: string;
    type?: string;
    required?: boolean;
    autoFormat?: 'cep' | 'cns' | 'cpf' | 'cnpj' | 'phone';
  }>) => fields.map((field) => (
    <Field key={field.key} label={field.label} required={field.required}>
      <Input
        type={field.type ?? 'text'}
        autoFormat={field.autoFormat}
        min={field.type === 'number' ? 0 : undefined}
        step={field.type === 'number' ? '0.01' : undefined}
        value={form[field.key]}
        onChange={(event) => updateForm(field.key, event.target.value)}
      />
    </Field>
  ));

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        <FilePlus2 className="kds-control-icon" aria-hidden="true" />
        Preparar titular para importação
      </Button>

      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          if (nextOpen) {
            setOpen(true);
          } else if (!saving) {
            close();
          }
        }}
        size="wide"
      >
        <DialogHeader>
          <DialogTitle>Preparar titular para importação</DialogTitle>
          <DialogDescription>
            Contrato {contract.codigo_contrato}. Os dados ficam em staging por até 24 horas e serão usados uma única vez pelo MCP.
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          {result ? (
            <Surface variant="muted" padding="md">
              <h3 className="font-semibold text-[var(--text-primary)]">Staging criado</h3>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                Copie o identificador e use-o na action <code>kifer_create_contract_holder_from_import</code>.
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <code className="rounded border border-[var(--border-subtle)] bg-[var(--surface-primary)] px-3 py-2 text-sm text-[var(--text-primary)]">
                  {result.import_id}
                </code>
                <Button variant="secondary" size="sm" onClick={() => void copyImportId()}>
                  {copied ? <ClipboardCheck className="kds-control-icon" aria-hidden="true" /> : <Clipboard className="kds-control-icon" aria-hidden="true" />}
                  {copied ? 'Copiado' : 'Copiar ID'}
                </Button>
              </div>
              <p className="mt-3 text-xs text-[var(--text-muted)]">
                Expira em {formatExpiration(result.expires_at)}. Nenhum dado pessoal é incluído na resposta ao MCP.
              </p>
            </Surface>
          ) : (
            <form id="holder-import-form" className="space-y-5" onSubmit={(event) => void submit(event)}>
              <Surface variant="muted" padding="sm">
                <h3 className="mb-4 text-sm font-semibold text-[var(--text-primary)]">Dados do titular</h3>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {renderFields(personalFields)}
                </div>
              </Surface>
              <Surface variant="muted" padding="sm">
                <h3 className="mb-4 text-sm font-semibold text-[var(--text-primary)]">Endereço</h3>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {renderFields(addressFields)}
                </div>
              </Surface>
              <Surface variant="muted" padding="sm">
                <h3 className="mb-4 text-sm font-semibold text-[var(--text-primary)]">Dados empresariais (se aplicável)</h3>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {renderFields(companyFields)}
                </div>
              </Surface>
              {errorMessage && <p className="text-sm text-[var(--danger-text)]" role="alert">{errorMessage}</p>}
            </form>
          )}
        </DialogBody>
        <DialogFooter>
          {result ? (
            <Button onClick={close}>Concluir</Button>
          ) : (
            <>
              <Button variant="secondary" onClick={close} disabled={saving}>Cancelar</Button>
              <Button type="submit" form="holder-import-form" loading={saving}>
                Criar staging protegido
              </Button>
            </>
          )}
        </DialogFooter>
      </Dialog>
    </>
  );
}
