import { Button, Textarea, WorkspaceDialog
} from '../../../../design-system';

type WhatsAppEditMessageModalProps = {
  isOpen: boolean;
  loading: boolean;
  value: string;
  title: string;
  description: string;
  onClose: () => void;
  onChange: (value: string) => void;
  onSubmit: () => void;
};

export default function WhatsAppEditMessageModal({
  isOpen,
  loading,
  value,
  title,
  description,
  onClose,
  onChange,
  onSubmit,
}: WhatsAppEditMessageModalProps) {
  return (
    <WorkspaceDialog
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      description={description}
      size="lg"
      footer={(
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={onSubmit} loading={loading} disabled={!value.trim()}>
            Salvar alterações
          </Button>
        </div>
      )}
    >
      <Textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={8}
        className="leading-6"
        placeholder="Digite a nova versão da mensagem"
        disabled={loading}
        autoFocus
      />
    </WorkspaceDialog>
  );
}
