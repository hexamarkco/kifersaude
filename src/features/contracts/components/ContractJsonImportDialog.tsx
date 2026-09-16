import { useRef, useState } from 'react';
import { CheckCircle2, Download, FileUp, Loader2 } from 'lucide-react';

import {
  CONTRACT_JSON_IMPORT_TEMPLATE,
  parseContractJsonImport,
  type ContractJsonImportPayload,
} from '../domain/contractJsonImport';
import {
  Alert,
  Button,
  Dialog,
  DialogBody,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../design-system';

type ContractJsonImportDialogProps = {
  onApply: (payload: ContractJsonImportPayload) => void;
  onClose: () => void;
};

const MAX_JSON_BYTES = 1 * 1024 * 1024;

const getFileError = (file: File) => {
  if (!file.name.toLowerCase().endsWith('.json')) return 'Selecione um arquivo com extensão .json.';
  if (file.size > MAX_JSON_BYTES) return 'O arquivo JSON pode ter no máximo 1 MB.';
  return null;
};

const downloadTemplate = () => {
  const file = new Blob(
    [JSON.stringify(CONTRACT_JSON_IMPORT_TEMPLATE, null, 2)],
    { type: 'application/json;charset=utf-8' },
  );
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'modelo-importacao-contratos.json';
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
};

export function ContractJsonImportDialog({
  onApply,
  onClose,
}: ContractJsonImportDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<ContractJsonImportPayload | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectFile = (nextFile: File | undefined) => {
    setFile(nextFile ?? null);
    setPayload(null);
    setError(nextFile ? getFileError(nextFile) : null);
  };

  const handleReadFile = async () => {
    if (!file) return;
    const fileError = getFileError(file);
    if (fileError) {
      setError(fileError);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      setPayload(parseContractJsonImport(await file.text()));
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Não foi possível ler o arquivo JSON.');
    } finally {
      setLoading(false);
    }
  };

  const contractFieldCount = payload ? Object.keys(payload.contract).length : 0;
  const holderFieldCount = payload?.holder ? Object.keys(payload.holder).length : 0;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()} size="md">
      <DialogHeader onClose={() => { if (!loading) onClose(); }}>
        <DialogTitle>Importar contrato por JSON</DialogTitle>
        <DialogDescription>
          Selecione um JSON no formato esperado. Os campos serão aplicados ao formulário para revisão; nada é salvo até você confirmar o contrato.
        </DialogDescription>
      </DialogHeader>
      <DialogBody className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--kds-radius-sm)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-3">
          <div className="min-w-0 text-sm text-[var(--text-secondary)]">
            <p className="font-medium text-[var(--text-primary)]">Baixe o modelo esperado</p>
            <p className="mt-1">O arquivo inclui os dados do contrato e, opcionalmente, do titular.</p>
          </div>
          <Button type="button" variant="secondary" size="sm" onClick={downloadTemplate}>
            <Download className="kds-control-icon" />
            Baixar modelo JSON
          </Button>
        </div>

        <div className="rounded-[var(--kds-radius-sm)] border border-dashed border-[var(--border-default)] bg-[var(--surface-primary)] p-5 text-center">
          <FileUp className="mx-auto h-7 w-7 text-[var(--brand-primary)]" />
          <p className="mt-2 font-medium text-[var(--text-primary)]">
            {file ? file.name : 'Escolha o arquivo JSON do contrato'}
          </p>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Valores numéricos podem ser números JSON. Datas em AAAA-MM-DD; renovação em AAAA-MM. taxa_adesao_tipo: nao_cobrar, percentual_mensalidade ou valor_fixo.
          </p>
          <input
            ref={inputRef}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            disabled={loading}
        onChange={(event) => {
          selectFile(event.target.files?.[0]);
          event.target.value = '';
        }}
          />
          <Button type="button" variant="secondary" size="sm" className="mt-4" onClick={() => inputRef.current?.click()} disabled={loading}>
            Selecionar arquivo JSON
          </Button>
        </div>

        {payload && (
          <Alert tone="success" title="JSON validado">
            {contractFieldCount} campo(s) do contrato e {holderFieldCount} campo(s) do titular prontos para aplicar. Revise os dados no formulário antes de salvar.
          </Alert>
        )}
        {error && <Alert tone="danger" title="Não foi possível importar o JSON">{error}</Alert>}
      </DialogBody>
      <DialogFooter>
        <Button type="button" variant="secondary" onClick={onClose} disabled={loading}>Cancelar</Button>
        {payload ? (
          <Button type="button" onClick={() => { onApply(payload); onClose(); }}>
            <CheckCircle2 className="kds-control-icon" />
            Aplicar ao formulário
          </Button>
        ) : (
          <Button type="button" disabled={!file || Boolean(error) || loading} onClick={() => void handleReadFile()}>
            {loading ? <Loader2 className="animate-spin" /> : <FileUp className="kds-control-icon" />}
            {loading ? 'Validando JSON...' : 'Validar arquivo'}
          </Button>
        )}
      </DialogFooter>
    </Dialog>
  );
}
