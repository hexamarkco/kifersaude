import { useRef, useState, type DragEvent } from 'react';
import { CheckCircle2, FileUp, Loader2, Sparkles, X } from 'lucide-react';

import {
  extractContractDocumentData,
  validateContractImportFiles,
} from '../data/contractDocumentImportRepository';
import {
  CONTRACT_DOCUMENT_PROFILES,
  type ContractDocumentExtraction,
  type ContractDocumentProfile,
  type ContractImportFieldKey,
} from '../domain/contractDocumentImport';
import {
  Alert,
  Button,
  Dialog,
  DialogBody,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  IconButton,
  Select,
} from '../../../design-system';

type ContractDocumentImportDialogProps = {
  onApply: (extraction: ContractDocumentExtraction) => void;
  onClose: () => void;
};

const profileLabels: Record<ContractDocumentProfile, string> = {
  auto: 'Detectar automaticamente',
  supermed: 'Supermed',
  hcommerce: 'HCommerce (Assim, Klini e similares)',
  planium: 'Planium (Hapvida, Leve e similares)',
  qualicorp: 'Qualicorp',
  medsenior: 'MedSênior',
  porto: 'Porto (orçamento PME)',
};

const fieldLabels: Record<ContractImportFieldKey, string> = {
  codigo_contrato: 'Código da proposta/contrato',
  modalidade: 'Modalidade',
  operadora: 'Operadora',
  produto_plano: 'Produto/plano',
  abrangencia: 'Abrangência',
  acomodacao: 'Acomodação',
  data_inicio: 'Início de vigência',
  mes_reajuste: 'Mês de reajuste',
  carencia: 'Carência',
  mensalidade_total: 'Mensalidade total',
  vidas: 'Vidas',
  cnpj: 'CNPJ',
  razao_social: 'Razão social',
  nome_fantasia: 'Nome fantasia',
  endereco_empresa: 'Endereço da empresa',
};

const fileSizeLabel = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

export function ContractDocumentImportDialog({
  onApply,
  onClose,
}: ContractDocumentImportDialogProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [profile, setProfile] = useState<ContractDocumentProfile>('auto');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [extraction, setExtraction] = useState<ContractDocumentExtraction | null>(null);
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const updateFiles = (nextFiles: File[]) => {
    setError(validateContractImportFiles(nextFiles));
    setFiles(nextFiles);
    setExtraction(null);
  };

  const handleFileDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDraggingFiles(false);
    updateFiles(Array.from(event.dataTransfer.files));
  };

  const removeFile = (fileToRemove: File) => {
    updateFiles(files.filter((file) => file !== fileToRemove));
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleExtract = async () => {
    const validationError = validateContractImportFiles(files);
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      setExtraction(await extractContractDocumentData({ files, profile }));
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Não foi possível ler os PDFs.');
    } finally {
      setLoading(false);
    }
  };

  const extractedFields = extraction
    ? (Object.entries(extraction.fields) as Array<[ContractImportFieldKey, string]>)
    : [];

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()} size="lg">
      <DialogHeader onClose={onClose}>
        <DialogTitle>Preencher a partir de PDFs</DialogTitle>
        <DialogDescription>
          O sistema lê a camada textual dos PDFs e usa IA somente quando faltam dados importantes. Revise tudo antes de salvar o contrato.
        </DialogDescription>
      </DialogHeader>
      <DialogBody className="min-w-0 space-y-5 overflow-x-hidden">
        {!extraction ? (
          <>
            <div className="grid min-w-0 gap-4 sm:grid-cols-2">
              <label className="block min-w-0 text-sm font-medium text-[var(--text-primary)]">
                Ajuste avançado do perfil (opcional)
                <Select
                  value={profile}
                  onChange={(event) => setProfile(event.target.value as ContractDocumentProfile)}
                  className="mt-2"
                  aria-label="Perfil do documento"
                  options={CONTRACT_DOCUMENT_PROFILES.map((option) => ({
                    value: option,
                    label: profileLabels[option],
                  }))}
                />
              </label>
              <div className="rounded-[var(--kds-radius-sm)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-3 text-sm text-[var(--text-secondary)]">
                <p className="font-medium text-[var(--text-primary)]">Como usar</p>
                <p className="mt-1">Prefira a detecção automática. Para Assim/Klini, envie juntos o PDF de empresa e o de titulares da mesma proposta.</p>
              </div>
            </div>

            <div
              className={`rounded-[var(--kds-radius-md)] border border-dashed bg-[var(--surface-muted)] p-5 text-center transition-colors ${
                isDraggingFiles
                  ? 'border-[var(--brand-primary)] bg-[var(--surface-primary)] shadow-[0_0_0_3px_color-mix(in_srgb,var(--brand-primary)_16%,transparent)]'
                  : 'border-[var(--border-default)] hover:border-[var(--brand-primary)]'
              }`}
              onDragEnter={(event) => {
                event.preventDefault();
                setIsDraggingFiles(true);
              }}
              onDragOver={(event) => event.preventDefault()}
              onDragLeave={(event) => {
                if (event.currentTarget === event.target) setIsDraggingFiles(false);
              }}
              onDrop={handleFileDrop}
            >
              <FileUp className="mx-auto h-7 w-7 text-[var(--brand-primary)]" />
              <p className="mt-2 font-medium text-[var(--text-primary)]">Arraste os PDFs ou escolha os arquivos</p>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">Até 4 arquivos, 16 MB por PDF e 28 MB no total.</p>
              <input
                ref={inputRef}
                type="file"
                accept="application/pdf,.pdf"
                multiple
                className="sr-only"
                onChange={(event) => updateFiles(Array.from(event.target.files ?? []))}
              />
              <Button type="button" variant="secondary" size="sm" className="mt-4" onClick={() => inputRef.current?.click()}>
                Selecionar PDFs
              </Button>
            </div>

            {files.length > 0 && (
              <ul className="space-y-2" aria-label="PDFs selecionados">
                {files.map((file) => (
                  <li key={`${file.name}-${file.lastModified}`} className="flex items-center justify-between gap-3 rounded-[var(--kds-radius-sm)] border border-[var(--border-subtle)] bg-[var(--surface-primary)] px-3 py-2 text-sm">
                    <span className="min-w-0 truncate text-[var(--text-primary)]">{file.name}</span>
                    <span className="ml-auto shrink-0 text-[var(--text-muted)]">{fileSizeLabel(file.size)}</span>
                    <IconButton
                      type="button"
                      size="sm"
                      variant="ghost"
                      aria-label={`Remover ${file.name}`}
                      onClick={() => removeFile(file)}
                    >
                      <X aria-hidden="true" />
                    </IconButton>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <div className="space-y-4">
            <Alert tone="success" title={`${extractedFields.length} campos prontos para revisão`}>
              Perfil identificado: {profileLabels[extraction.profile]}. Processamento: {extraction.metadata?.usedLlm
                ? extraction.metadata.usedVision ? 'IA com páginas selecionadas' : 'IA com trechos selecionados'
                : extraction.metadata?.cacheHit ? 'resultado reutilizado do cache' : 'leitura local, sem chamada de IA'}. Nada é salvo ainda.
            </Alert>
            <div className="rounded-[var(--kds-radius-md)] border border-[var(--border-subtle)]">
              <dl className="divide-y divide-[var(--border-subtle)]">
                {extractedFields.map(([key, value]) => (
                  <div key={key} className="grid gap-1 px-3 py-2.5 sm:grid-cols-[12rem_1fr] sm:gap-3">
                    <dt className="text-sm font-medium text-[var(--text-secondary)]">{fieldLabels[key]}</dt>
                    <dd className="min-w-0 text-sm text-[var(--text-primary)]">
                      <span className="block break-words">{value}</span>
                      {extraction.fieldSources[key] && <span className="mt-0.5 block text-xs text-[var(--text-muted)]">{extraction.fieldSources[key]}</span>}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
            {(extraction.holderCount > 0 || extraction.dependentCount > 0) && (
              <p className="text-sm text-[var(--text-secondary)]">
                O documento indica {extraction.holderCount} titular(es) e {extraction.dependentCount} dependente(s). {extraction.holder
                  ? 'O titular principal será pré-preenchido na próxima etapa após salvar o contrato.'
                  : 'Os cadastros continuam na etapa própria após salvar o contrato.'}
              </p>
            )}
            {extraction.warnings.map((warning) => (
              <Alert key={warning} tone="warning" title="Revisão necessária">{warning}</Alert>
            ))}
          </div>
        )}

        {error && <Alert tone="danger" title="Não foi possível preparar a leitura">{error}</Alert>}
      </DialogBody>
      <DialogFooter>
        {extraction ? (
          <>
            <Button type="button" variant="secondary" onClick={() => setExtraction(null)}>Ler outros PDFs</Button>
            <Button type="button" onClick={() => { onApply(extraction); onClose(); }}>
              <CheckCircle2 className="kds-control-icon" /> Aplicar ao formulário
            </Button>
          </>
        ) : (
          <>
            <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
            <Button type="button" disabled={loading || files.length === 0} onClick={() => void handleExtract()}>
              {loading ? <Loader2 className="animate-spin" /> : <Sparkles className="kds-control-icon" />}
              {loading ? 'Lendo PDFs...' : 'Ler e sugerir campos'}
            </Button>
          </>
        )}
      </DialogFooter>
    </Dialog>
  );
}
