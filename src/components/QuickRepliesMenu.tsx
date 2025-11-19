import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, MessageCirclePlus, Pencil } from 'lucide-react';
import type { QuickReply } from '../lib/supabase';

type QuickReplyDraft = {
  title: string;
  text: string;
};

type QuickRepliesMenuProps = {
  quickReplies: QuickReply[];
  selectedReplyId: string | null;
  onSelect: (reply: QuickReply) => void;
  onCreate: (draft: QuickReplyDraft) => Promise<void>;
  onUpdate: (id: string, draft: QuickReplyDraft) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  isLoading?: boolean;
  error?: string | null;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  renderTrigger?: (props: {
    menuOpen: boolean;
    toggleMenu: () => void;
    openMenu: () => void;
    closeMenu: () => void;
  }) => ReactNode;
};

const normalizeDraft = (draft: QuickReplyDraft): QuickReplyDraft => ({
  title: draft.title.trim(),
  text: draft.text.trim(),
});

const DEFAULT_DRAFT: QuickReplyDraft = {
  title: '',
  text: '',
};

const createDisplayLabel = (reply: QuickReply) => {
  const labelSource = reply.title?.trim() ?? reply.text;
  if (labelSource.length <= 80) {
    return labelSource;
  }
  return `${labelSource.slice(0, 77)}...`;
};

const EMPTY_STATE_TEXT =
  'Nenhuma resposta rápida cadastrada ainda. Crie uma para facilitar seus atendimentos.';

export default function QuickRepliesMenu({
  quickReplies,
  selectedReplyId,
  onSelect,
  onCreate,
  onUpdate,
  onDelete,
  isLoading = false,
  error = null,
  isOpen: controlledIsOpen,
  onOpenChange,
  renderTrigger,
}: QuickRepliesMenuProps) {
  const [internalMenuOpen, setInternalMenuOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<QuickReplyDraft>(DEFAULT_DRAFT);
  const [newDraft, setNewDraft] = useState<QuickReplyDraft>(DEFAULT_DRAFT);
  const [actionError, setActionError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const isControlled = typeof controlledIsOpen === 'boolean';
  const menuOpen = isControlled ? (controlledIsOpen as boolean) : internalMenuOpen;

  const hasReplies = quickReplies.length > 0;

  const resetEditingState = useCallback(() => {
    setEditingId(null);
    setDraft(DEFAULT_DRAFT);
    setSavingId(null);
  }, []);

  const setMenuOpenState = useCallback(
    (nextState: boolean) => {
      if (!isControlled) {
        setInternalMenuOpen(nextState);
      }
      onOpenChange?.(nextState);
    },
    [isControlled, onOpenChange],
  );

  const closeMenu = () => {
    if (!menuOpen) {
      return;
    }

    setMenuOpenState(false);
    setActionError(null);
    if (editingId) {
      resetEditingState();
    }
  };

  const openMenu = () => {
    if (menuOpen) {
      return;
    }

    setMenuOpenState(true);
    setActionError(null);
  };

  const toggleMenu = () => {
    if (menuOpen) {
      closeMenu();
      return;
    }

    openMenu();
  };

  const startEditing = (reply: QuickReply) => {
    setEditingId(reply.id);
    setDraft({
      title: reply.title ?? '',
      text: reply.text,
    });
    setActionError(null);
  };

  const handleSelect = (reply: QuickReply) => {
    onSelect(reply);
    closeMenu();
  };

  const handleDraftChange = (key: keyof QuickReplyDraft, value: string, target: 'draft' | 'new') => {
    if (target === 'draft') {
      setDraft(previous => ({ ...previous, [key]: value }));
    } else {
      setNewDraft(previous => ({ ...previous, [key]: value }));
    }
  };

  const handleSaveEdit = async () => {
    if (!editingId) {
      return;
    }

    const normalized = normalizeDraft(draft);
    if (!normalized.text) {
      setActionError('O conteúdo da resposta não pode estar vazio.');
      return;
    }

    try {
      setSavingId(editingId);
      await onUpdate(editingId, normalized);
      resetEditingState();
      setActionError(null);
    } catch (updateError) {
      console.error(updateError);
      setActionError('Não foi possível salvar a resposta rápida. Tente novamente.');
    } finally {
      setSavingId(null);
    }
  };

  const handleCreate = async () => {
    const normalized = normalizeDraft(newDraft);
    if (!normalized.text) {
      setActionError('Digite o conteúdo da resposta rápida antes de salvar.');
      return;
    }

    try {
      setCreating(true);
      await onCreate(normalized);
      setNewDraft(DEFAULT_DRAFT);
      setActionError(null);
    } catch (createError) {
      console.error(createError);
      setActionError('Não foi possível criar a resposta rápida. Tente novamente.');
    } finally {
      setCreating(false);
    }
  };

  useEffect(() => {
    if (!menuOpen) {
      setActionError(null);
      if (editingId) {
        setEditingId(null);
        setDraft(DEFAULT_DRAFT);
        setSavingId(null);
      }
    }
  }, [menuOpen, editingId]);

  useEffect(() => {
    if (!menuOpen) {
      return;
    }

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target || !containerRef.current) {
        return;
      }

      if (containerRef.current.contains(target)) {
        return;
      }

      setMenuOpenState(false);
      setActionError(null);
      if (editingId) {
        resetEditingState();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [editingId, menuOpen, resetEditingState, setMenuOpenState]);

  const handleDelete = async (id: string) => {
    if (!onDelete) {
      return;
    }

    try {
      setSavingId(id);
      await onDelete(id);
      if (editingId === id) {
        resetEditingState();
      }
      setActionError(null);
    } catch (deleteError) {
      console.error(deleteError);
      setActionError('Não foi possível remover a resposta rápida. Tente novamente.');
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      {renderTrigger ? (
        renderTrigger({
          menuOpen,
          toggleMenu,
          openMenu,
          closeMenu,
        })
      ) : (
        <button
          type="button"
          className="inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-slate-500 transition hover:text-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
          onClick={toggleMenu}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          aria-label="Abrir respostas rápidas"
          data-testid="quick-replies-toggle"
        >
          <MessageCirclePlus className="h-5 w-5" />
        </button>
      )}

      {menuOpen ? (
        <div
          className="absolute bottom-full left-0 mb-2 w-80 max-w-xs rounded-xl border border-slate-200 bg-white p-3 text-sm shadow-xl"
          role="menu"
        >
          <div className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-slate-500">
            <span>Respostas rápidas</span>
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin text-slate-400" aria-label="Carregando respostas" /> : null}
          </div>

          {error ? <p className="mb-2 text-xs text-red-600">{error}</p> : null}
          {actionError ? <p className="mb-2 text-xs text-red-600">{actionError}</p> : null}

          {hasReplies ? (
            <ul className="space-y-2" aria-label="Lista de respostas rápidas">
              {quickReplies.map(reply => {
                const isSelected = reply.id === selectedReplyId;
                const isEditing = reply.id === editingId;
                const isSaving = savingId === reply.id;

                return (
                  <li key={reply.id} className="rounded-lg border border-slate-200 p-2">
                    <button
                      type="button"
                      onClick={() => handleSelect(reply)}
                      className={`w-full text-left text-sm transition focus:outline-none ${
                        isSelected ? 'text-emerald-600' : 'text-slate-700 hover:text-emerald-600'
                      }`}
                      role="menuitemradio"
                      aria-checked={isSelected}
                      data-reply-id={reply.id}
                      data-testid="quick-reply-option"
                    >
                      {createDisplayLabel(reply)}
                    </button>

                    <div className="mt-2 flex items-center gap-2 text-xs">
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-slate-500 transition hover:text-emerald-600 focus:outline-none"
                        onClick={() => (isEditing ? resetEditingState() : startEditing(reply))}
                        aria-label={isEditing ? 'Cancelar edição' : 'Editar resposta rápida'}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        {isEditing ? 'Cancelar' : 'Editar'}
                      </button>
                      {onDelete ? (
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-red-500 transition hover:text-red-600 focus:outline-none"
                          onClick={() => handleDelete(reply.id)}
                          disabled={isSaving}
                        >
                          {isSaving ? 'Removendo...' : 'Remover'}
                        </button>
                      ) : null}
                    </div>

                    {isEditing ? (
                      <div className="mt-2 space-y-2">
                        <div>
                          <label className="sr-only" htmlFor={`quick-reply-title-${reply.id}`}>
                            Título da resposta rápida
                          </label>
                          <input
                            id={`quick-reply-title-${reply.id}`}
                            type="text"
                            value={draft.title}
                            onChange={event => handleDraftChange('title', event.target.value, 'draft')}
                            className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                            placeholder="Título (opcional)"
                          />
                        </div>
                        <div>
                          <label className="sr-only" htmlFor={`quick-reply-text-${reply.id}`}>
                            Conteúdo da resposta rápida
                          </label>
                          <textarea
                            id={`quick-reply-text-${reply.id}`}
                            value={draft.text}
                            onChange={event => handleDraftChange('text', event.target.value, 'draft')}
                            className="h-24 w-full resize-none rounded-md border border-slate-300 px-2 py-1 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={handleSaveEdit}
                          className="inline-flex items-center justify-center rounded-full bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 disabled:cursor-not-allowed disabled:opacity-60"
                          disabled={savingId === reply.id}
                        >
                          {savingId === reply.id ? 'Salvando...' : 'Salvar alterações'}
                        </button>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="rounded-lg border border-dashed border-slate-300 p-3 text-xs text-slate-500">
              {EMPTY_STATE_TEXT}
            </p>
          )}

          <div className="mt-3 space-y-2 border-t border-slate-200 pt-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Nova resposta</p>
            <div>
              <label className="sr-only" htmlFor="quick-reply-new-title">
                Título da nova resposta rápida
              </label>
              <input
                id="quick-reply-new-title"
                type="text"
                value={newDraft.title}
                onChange={event => handleDraftChange('title', event.target.value, 'new')}
                className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                placeholder="Título (opcional)"
              />
            </div>
            <div>
              <label className="sr-only" htmlFor="quick-reply-new-text">
                Conteúdo da nova resposta rápida
              </label>
              <textarea
                id="quick-reply-new-text"
                value={newDraft.text}
                onChange={event => handleDraftChange('text', event.target.value, 'new')}
                className="h-20 w-full resize-none rounded-md border border-slate-300 px-2 py-1 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                placeholder="Digite a mensagem padrão"
              />
            </div>
            <button
              type="button"
              onClick={handleCreate}
              className="inline-flex items-center justify-center rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={creating}
            >
              {creating ? 'Adicionando...' : 'Adicionar resposta'}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
