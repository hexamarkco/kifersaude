import { type ReactNode, useCallback, useEffect, useId, useRef, useState } from 'react';
import { Loader2, MessageCirclePlus, Pencil, X } from 'lucide-react';
import type { QuickReply } from '../lib/supabase';
import {
  WHATSAPP_MESSAGE_VARIABLES,
  WHATSAPP_MESSAGE_VARIABLE_HINTS,
} from '../constants/whatsappMessageVariables';

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
  'Nenhuma mensagem rápida cadastrada ainda. Crie uma para facilitar seus atendimentos.';

const focusTextareaLater = (element: HTMLTextAreaElement | null, position: number) => {
  if (!element) {
    return;
  }

  const focusAction = () => {
    element.focus();
    element.setSelectionRange(position, position);
  };

  if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
    window.requestAnimationFrame(focusAction);
  } else {
    focusAction();
  }
};

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
  const [showVariableListForDraft, setShowVariableListForDraft] = useState(false);
  const [showVariableListForNew, setShowVariableListForNew] = useState(false);
  const editingTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const newTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const modalTitleId = useId();
  const modalDescriptionId = useId();

  const isControlled = typeof controlledIsOpen === 'boolean';
  const menuOpen = isControlled ? (controlledIsOpen as boolean) : internalMenuOpen;

  const hasReplies = quickReplies.length > 0;

  const resetEditingState = useCallback(() => {
    setEditingId(null);
    setDraft(DEFAULT_DRAFT);
    setSavingId(null);
    editingTextareaRef.current = null;
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

  const closeMenu = useCallback(() => {
    if (!menuOpen) {
      return;
    }

    setMenuOpenState(false);
    setActionError(null);
    setShowVariableListForDraft(false);
    setShowVariableListForNew(false);
    if (editingId) {
      resetEditingState();
    }
  }, [editingId, menuOpen, resetEditingState, setMenuOpenState]);

  const openMenu = useCallback(() => {
    if (menuOpen) {
      return;
    }

    setMenuOpenState(true);
    setActionError(null);
  }, [menuOpen, setMenuOpenState]);

  const toggleMenu = useCallback(() => {
    if (menuOpen) {
      closeMenu();
      return;
    }

    openMenu();
  }, [closeMenu, menuOpen, openMenu]);

  const startEditing = (reply: QuickReply) => {
    setEditingId(reply.id);
    setDraft({
      title: reply.title ?? '',
      text: reply.text,
    });
    setActionError(null);
    setShowVariableListForDraft(false);
  };

  const handleSelect = useCallback(
    (reply: QuickReply) => {
      onSelect(reply);
      closeMenu();
    },
    [closeMenu, onSelect],
  );

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
      setActionError('O conteúdo da mensagem não pode estar vazio.');
      return;
    }

    try {
      setSavingId(editingId);
      await onUpdate(editingId, normalized);
      resetEditingState();
      setActionError(null);
    } catch (updateError) {
      console.error(updateError);
      setActionError('Não foi possível salvar a mensagem rápida. Tente novamente.');
    } finally {
      setSavingId(null);
    }
  };

  const handleCreate = async () => {
    const normalized = normalizeDraft(newDraft);
    if (!normalized.text) {
      setActionError('Digite o conteúdo da mensagem rápida antes de salvar.');
      return;
    }

    try {
      setCreating(true);
      await onCreate(normalized);
      setNewDraft(DEFAULT_DRAFT);
      setActionError(null);
    } catch (createError) {
      console.error(createError);
      setActionError('Não foi possível criar a mensagem rápida. Tente novamente.');
    } finally {
      setCreating(false);
    }
  };

  const insertVariableToken = useCallback(
    (token: string, target: 'draft' | 'new') => {
      const textarea = target === 'draft' ? editingTextareaRef.current : newTextareaRef.current;
      const selectionStart = textarea?.selectionStart ?? null;
      const selectionEnd = textarea?.selectionEnd ?? null;

      const applyInsertion = (value: string) => {
        const start = selectionStart ?? value.length;
        const end = selectionEnd ?? start;
        const nextText = `${value.slice(0, start)}${token}${value.slice(end)}`;
        return { nextText, caret: start + token.length };
      };

      if (target === 'draft') {
        setDraft(previous => {
          const { nextText, caret } = applyInsertion(previous.text);
          if (textarea && typeof caret === 'number') {
            focusTextareaLater(textarea, caret);
          }
          return { ...previous, text: nextText };
        });
        return;
      }

      setNewDraft(previous => {
        const { nextText, caret } = applyInsertion(previous.text);
        if (textarea && typeof caret === 'number') {
          focusTextareaLater(textarea, caret);
        }
        return { ...previous, text: nextText };
      });
    },
    [],
  );

  const renderVariableHelper = (target: 'draft' | 'new') => {
    const isExpanded = target === 'draft' ? showVariableListForDraft : showVariableListForNew;
    const toggleExpanded = () =>
      (target === 'draft'
        ? setShowVariableListForDraft(previous => !previous)
        : setShowVariableListForNew(previous => !previous));

    return (
      <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">
        <p>
          Use variáveis como{' '}
          {WHATSAPP_MESSAGE_VARIABLE_HINTS.map((token, hintIndex) => (
            <code
              key={`${target}-hint-${token}-${hintIndex}`}
              className="mr-1 rounded bg-white px-1 py-0.5 font-mono text-[11px] text-slate-700"
            >
              {token}
            </code>
          ))}
          para personalizar com nome, saudação e contratos.
        </p>
        <button
          type="button"
          onClick={toggleExpanded}
          className="text-[11px] font-semibold text-emerald-600 transition hover:text-emerald-700"
        >
          {isExpanded ? 'Ocultar variáveis' : 'Ver todas as variáveis'}
        </button>
        {isExpanded ? (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {WHATSAPP_MESSAGE_VARIABLES.map(variable => (
              <div key={`${target}-${variable.token}`} className="rounded-lg border border-slate-200 bg-white p-2">
                <div className="flex items-center justify-between gap-2">
                  <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-700">
                    {variable.token}
                  </code>
                  <button
                    type="button"
                    onClick={() => insertVariableToken(variable.token, target)}
                    className="text-[11px] font-semibold text-emerald-600 transition hover:text-emerald-700"
                  >
                    Inserir
                  </button>
                </div>
                <p className="mt-1 text-[11px] leading-snug text-slate-600">{variable.description}</p>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    );
  };

  useEffect(() => {
    if (!menuOpen) {
      setActionError(null);
      setShowVariableListForDraft(false);
      setShowVariableListForNew(false);
      if (editingId) {
        setEditingId(null);
        setDraft(DEFAULT_DRAFT);
        setSavingId(null);
        editingTextareaRef.current = null;
      }
    }
  }, [editingId, menuOpen]);

  useEffect(() => {
    if (!menuOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeMenu();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [closeMenu, menuOpen]);

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
      setActionError('Não foi possível remover a mensagem rápida. Tente novamente.');
    } finally {
      setSavingId(null);
    }
  };

  return (
    <>
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
          aria-haspopup="dialog"
          aria-expanded={menuOpen}
          aria-label="Abrir mensagens rápidas"
          data-testid="quick-replies-toggle"
        >
          <MessageCirclePlus className="h-5 w-5" />
        </button>
      )}

      {menuOpen ? (
        <>
          <div className="fixed inset-0 z-40 bg-slate-900/60" aria-hidden="true" onClick={closeMenu} />
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center px-4 py-10">
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby={modalTitleId}
                aria-describedby={modalDescriptionId}
                className="w-full max-w-5xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
              >
                <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-4">
                  <div>
                    <h2 id={modalTitleId} className="text-lg font-semibold text-slate-900">
                      Mensagens rápidas
                    </h2>
                    <p id={modalDescriptionId} className="text-sm text-slate-500">
                      Crie textos padrão com variáveis para personalizar seus atendimentos.
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {isLoading ? (
                      <Loader2 className="h-5 w-5 animate-spin text-slate-400" aria-label="Carregando mensagens" />
                    ) : null}
                    <button
                      type="button"
                      onClick={closeMenu}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-400 transition hover:text-slate-600"
                      aria-label="Fechar modal de mensagens rápidas"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                </div>

                <div className="px-6 py-5">
                  {error ? (
                    <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                      {error}
                    </div>
                  ) : null}
                  {actionError ? (
                    <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                      {actionError}
                    </div>
                  ) : null}

                  <div className="flex flex-col gap-6 lg:flex-row">
                    <div className="flex-1 space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-slate-700">Mensagens salvas</p>
                          <p className="text-xs text-slate-500">Clique para usar no chat selecionado.</p>
                        </div>
                      </div>

                      {hasReplies ? (
                        <ul className="space-y-3" aria-label="Lista de mensagens rápidas">
                          {quickReplies.map(reply => {
                            const isSelected = reply.id === selectedReplyId;
                            const isEditing = reply.id === editingId;
                            const isSaving = savingId === reply.id;

                            return (
                              <li key={reply.id} className="rounded-2xl border border-slate-200 p-4 shadow-sm">
                                <div className="flex items-start justify-between gap-3">
                                  <button
                                    type="button"
                                    onClick={() => handleSelect(reply)}
                                    className={`flex-1 text-left transition focus:outline-none ${
                                      isSelected ? 'text-emerald-700' : 'text-slate-700 hover:text-emerald-600'
                                    }`}
                                    aria-pressed={isSelected}
                                    data-reply-id={reply.id}
                                    data-testid="quick-reply-option"
                                  >
                                    <p className="text-sm font-semibold">
                                      {reply.title?.trim() || createDisplayLabel(reply)}
                                    </p>
                                    <p className="mt-1 text-xs text-slate-500 line-clamp-2">{reply.text}</p>
                                  </button>
                                  {isSelected ? (
                                    <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
                                      Selecionada
                                    </span>
                                  ) : null}
                                </div>

                                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                                  <button
                                    type="button"
                                    className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-2.5 py-1 font-semibold text-slate-600 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
                                    onClick={() => (isEditing ? resetEditingState() : startEditing(reply))}
                                    aria-label={isEditing ? 'Cancelar edição' : 'Editar mensagem rápida'}
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                    {isEditing ? 'Cancelar' : 'Editar'}
                                  </button>
                                  {onDelete ? (
                                    <button
                                      type="button"
                                      className="inline-flex items-center gap-1 rounded-full border border-red-200 px-2.5 py-1 font-semibold text-red-600 transition hover:bg-red-50"
                                      onClick={() => handleDelete(reply.id)}
                                      disabled={isSaving}
                                    >
                                      {isSaving ? 'Removendo…' : 'Remover'}
                                    </button>
                                  ) : null}
                                </div>

                                {isEditing ? (
                                  <div className="mt-3 space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                                    <div>
                                      <label className="sr-only" htmlFor={`quick-reply-title-${reply.id}`}>
                                        Título da mensagem rápida
                                      </label>
                                      <input
                                        id={`quick-reply-title-${reply.id}`}
                                        type="text"
                                        value={draft.title}
                                        onChange={event => handleDraftChange('title', event.target.value, 'draft')}
                                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                                        placeholder="Título (opcional)"
                                      />
                                    </div>
                                    <div>
                                      <label className="sr-only" htmlFor={`quick-reply-text-${reply.id}`}>
                                        Conteúdo da mensagem rápida
                                      </label>
                                      <textarea
                                        id={`quick-reply-text-${reply.id}`}
                                        ref={node => {
                                          if (isEditing) {
                                            editingTextareaRef.current = node;
                                          }
                                        }}
                                        value={draft.text}
                                        onChange={event => handleDraftChange('text', event.target.value, 'draft')}
                                        className="h-28 w-full resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                                      />
                                    </div>
                                    {renderVariableHelper('draft')}
                                    <button
                                      type="button"
                                      onClick={handleSaveEdit}
                                      className="inline-flex w-full items-center justify-center rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 disabled:cursor-not-allowed disabled:opacity-60"
                                      disabled={savingId === reply.id}
                                    >
                                      {savingId === reply.id ? 'Salvando…' : 'Salvar alterações'}
                                    </button>
                                  </div>
                                ) : null}
                              </li>
                            );
                          })}
                        </ul>
                      ) : (
                        <p className="rounded-xl border border-dashed border-slate-300 p-6 text-sm text-slate-500">
                          {EMPTY_STATE_TEXT}
                        </p>
                      )}
                    </div>

                    <div className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 lg:w-80">
                      <p className="text-sm font-semibold text-slate-700">Nova mensagem rápida</p>
                      <div className="mt-3 space-y-3">
                        <div>
                          <label className="sr-only" htmlFor="quick-reply-new-title">
                            Título da nova mensagem rápida
                          </label>
                          <input
                            id="quick-reply-new-title"
                            type="text"
                            value={newDraft.title}
                            onChange={event => handleDraftChange('title', event.target.value, 'new')}
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                            placeholder="Título (opcional)"
                          />
                        </div>
                        <div>
                          <label className="sr-only" htmlFor="quick-reply-new-text">
                            Conteúdo da nova mensagem rápida
                          </label>
                          <textarea
                            id="quick-reply-new-text"
                            ref={newTextareaRef}
                            value={newDraft.text}
                            onChange={event => handleDraftChange('text', event.target.value, 'new')}
                            className="h-32 w-full resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                            placeholder="Digite a mensagem padrão"
                          />
                        </div>
                        {renderVariableHelper('new')}
                        <button
                          type="button"
                          onClick={handleCreate}
                          className="inline-flex w-full items-center justify-center rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 disabled:cursor-not-allowed disabled:opacity-60"
                          disabled={creating}
                        >
                          {creating ? 'Adicionando…' : 'Salvar mensagem'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </>
  );
}
