import Button from '../../../../components/ui/Button';
import ModalShell from '../../../../components/ui/ModalShell';
import Textarea from '../../../../components/ui/Textarea';

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
    <ModalShell
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
            Salvar alteracoes
          </Button>
        </div>
      )}
    >
      <Textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={8}
        className="text-sm leading-6"
        placeholder="Digite a nova versao da mensagem"
        disabled={loading}
        autoFocus
      />
    </ModalShell>
  );
}
