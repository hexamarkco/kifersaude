import { useRef, useState } from 'react';
import { CheckCircle2, Download, FileUp, Loader2 } from 'lucide-react';

import {
  CONTRACT_JSON_BULK_IMPORT_TEMPLATE,
  MAX_CONTRACTS_PER_JSON_IMPORT,
  parseBulkContractJsonImport,
  type ContractJsonBulkImportPayload,
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

type ContractBulkJsonImportDialogProps = {
  onImport: (contracts: ContractJsonBulkImportPayload['contracts']) => Promise<void>;
  onClose: () => void;
};

const MAX_JSON_BYTES = 5 * 1024 * 1024;

const downloadTemplate = () => {
  const file = new Blob(
    [JSON.stringify(CONTRACT_JSON_BULK_IMPORT_TEMPLATE, null, 2)],
    { type: 'application/json;charset=utf-8' },
  );
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'modelo-importacao-em-massa-contratos.json';
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
};

export function ContractBulkJsonImportDialog({
  onImport,
  onClose,
}: ContractBulkJsonImportDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<ContractJsonBulkImportPayload | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectFile = (nextFile: File | undefined) => {
    setFile(nextFile ?? null);
    setPayload(null);
    if (!nextFile) {
      setError(null);
    } else if (!nextFile.name.toLowerCase().endsWith('.json')) {
      setError('Selecione um arquivo com extensão .json.');
    } else if (nextFile.size > MAX_JSON_BYTES) {
      setError('O arquivo JSON pode ter no máximo 5 MB.');
    } else {
      setError(null);
    }
  };

  const handleValidate = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      setPayload(parseBulkContractJsonImport(await file.text()));
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Não foi possível ler o arquivo JSON.');
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!payload) return;
    setImporting(true);
    setError(null);
    try {
      await onImport(payload.contracts);
      onClose();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Não foi possível importar os contratos.');
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && !importing && onClose()} size="lg">
      <DialogHeader onClose={() => { if (!importing) onClose(); }}>
        <DialogTitle>Importar contratos em massa</DialogTitle>
        <DialogDescription>
          Valide o arquivo e revise a lista antes de importar. O lote não associa leads nem importa titulares, dependentes, parcelas de comissão ou faixas de bônus; esses dados podem ser completados depois.
        </DialogDescription>
      </DialogHeader>
      <DialogBody className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--kds-radius-sm)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-3">
          <div className="min-w-0 text-sm text-[var(--text-secondary)]">
            <p className="font-medium text-[var(--text-primary)]">Formato do arquivo</p>
            <p className="mt-1">Objeto com uma lista <code>contratos</code>; até {MAX_CONTRACTS_PER_JSON_IMPORT} contratos em um arquivo.</p>
          </div>
          <Button type="button" variant="secondary" size="sm" onClick={downloadTemplate}>
            <Download className="kds-control-icon" />
            Baixar modelo do lote
          </Button>
        </div>

        <div className="rounded-[var(--kds-radius-sm)] border border-dashed border-[var(--border-default)] bg-[var(--surface-primary)] p-5 text-center">
          <FileUp className="mx-auto h-7 w-7 text-[var(--brand-primary)]" />
          <p className="mt-2 break-all font-medium text-[var(--text-primary)]">
            {file ? file.name : 'Escolha o arquivo JSON com os contratos'}
          </p>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Campos obrigatórios por item: código, status, modalidade, operadora, produto/plano e responsável. Datas em AAAA-MM-DD, renovação em AAAA-MM. Máximo de 5 MB.
          </p>
          <input
            ref={inputRef}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            onChange={(event) => {
              selectFile(event.target.files?.[0]);
              event.target.value = '';
            }}
          />
          <Button type="button" variant="secondary" size="sm" className="mt-4" onClick={() => inputRef.current?.click()}>
            Selecionar arquivo JSON
          </Button>
        </div>

        {payload && (
          <Alert tone="success" title={`${payload.contracts.length} contrato(s) pronto(s) para importação`}>
            <div className="mt-2 max-h-36 overflow-y-auto">
              <ul className="list-inside list-disc space-y-1">
                {payload.contracts.slice(0, 8).map((contract) => (
                  <li key={String(contract.codigo_contrato)}>
                    {contract.codigo_contrato} · {contract.operadora} · {contract.produto_plano}
                  </li>
                ))}
              </ul>
              {payload.contracts.length > 8 && (
                <p className="mt-1">e mais {payload.contracts.length - 8} contrato(s).</p>
              )}
            </div>
            <p className="mt-2">O lote é enviado em uma única operação. Se houver erro ou código já cadastrado, nenhum item do lote será incluído.</p>
          </Alert>
        )}
        {error && <Alert tone="danger" title="Não foi possível importar o arquivo">{error}</Alert>}
      </DialogBody>
      <DialogFooter>
        <Button type="button" variant="secondary" onClick={onClose} disabled={importing}>Cancelar</Button>
        {payload ? (
          <Button type="button" onClick={() => void handleImport()} disabled={importing}>
            {importing ? <Loader2 className="animate-spin" /> : <CheckCircle2 className="kds-control-icon" />}
            {importing ? 'Importando contratos...' : `Importar ${payload.contracts.length} contrato(s)`}
          </Button>
        ) : (
          <Button type="button" disabled={!file || Boolean(error) || loading} onClick={() => void handleValidate()}>
            {loading ? <Loader2 className="animate-spin" /> : <FileUp className="kds-control-icon" />}
            {loading ? 'Validando JSON...' : 'Validar arquivo'}
          </Button>
        )}
      </DialogFooter>
    </Dialog>
  );
}
