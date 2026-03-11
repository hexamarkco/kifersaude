import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import Textarea, { type TextareaSize } from './Textarea';
import type { TemplateVariableSuggestion } from '../../lib/templateVariableSuggestions';

type VariableAutocompleteTextareaProps = {
  value: string;
  onChange: (value: string) => void;
  suggestions: TemplateVariableSuggestion[];
  placeholder?: string;
  rows?: number;
  size?: TextareaSize;
  className?: string;
  disabled?: boolean;
};

export default function VariableAutocompleteTextarea({
  value,
  onChange,
  suggestions,
  placeholder,
  rows = 3,
  size = 'default',
  className,
  disabled = false,
}: VariableAutocompleteTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const activeMatch = useMemo(() => {
    const textarea = textareaRef.current;
    if (!textarea) return null;

    const cursorPosition = textarea.selectionStart ?? value.length;
    const textBeforeCursor = value.slice(0, cursorPosition);
    const match = textBeforeCursor.match(/\{\{([a-zA-Z0-9_]*)$/);

    if (!match) return null;

    return {
      query: (match[1] || '').toLowerCase(),
      start: cursorPosition - match[0].length,
      end: cursorPosition,
    };
  }, [value]);

  const filteredSuggestions = useMemo(() => {
    if (!activeMatch) return [];
    return suggestions.filter((item) => item.key.includes(activeMatch.query));
  }, [activeMatch, suggestions]);

  useEffect(() => {
    if (filteredSuggestions.length === 0) {
      setActiveIndex(0);
      return;
    }

    setActiveIndex((previous) => Math.min(previous, filteredSuggestions.length - 1));
  }, [filteredSuggestions]);

  const insertSuggestion = (key: string) => {
    const token = `{{${key}}}`;
    const textarea = textareaRef.current;

    if (!textarea || !activeMatch) {
      onChange(`${value}${token}`);
      return;
    }

    const nextValue = value.slice(0, activeMatch.start) + token + value.slice(activeMatch.end);
    onChange(nextValue);
    setActiveIndex(0);

    requestAnimationFrame(() => {
      const nextCursor = activeMatch.start + token.length;
      textarea.focus();
      textarea.setSelectionRange(nextCursor, nextCursor);
    });
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (filteredSuggestions.length === 0) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((previous) => (previous + 1) % filteredSuggestions.length);
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((previous) => (previous === 0 ? filteredSuggestions.length - 1 : previous - 1));
      return;
    }

    if (event.key === 'Enter' || event.key === 'Tab') {
      event.preventDefault();
      const selected = filteredSuggestions[activeIndex];
      if (selected) {
        insertSuggestion(selected.key);
      }
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      setActiveIndex(0);
    }
  };

  return (
    <div className="relative">
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={handleKeyDown}
        onClick={() => setActiveIndex(0)}
        rows={rows}
        size={size}
        className={className}
        placeholder={placeholder}
        disabled={disabled}
      />

      {filteredSuggestions.length > 0 && !disabled && (
        <div className="absolute left-0 right-0 top-full z-20 mt-2 overflow-hidden rounded-lg border border-[var(--panel-border,#d4c0a7)] bg-[var(--panel-surface,#fffdfa)] shadow-xl">
          <div className="border-b border-[var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface-muted,#f7f0e7)] px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-[var(--panel-text-muted,#876f5c)]">
            Variaveis disponiveis
          </div>
          <div className="max-h-64 overflow-y-auto py-1">
            {filteredSuggestions.map((suggestion, index) => {
              const isActive = index === activeIndex;

              return (
                <button
                  key={suggestion.key}
                  type="button"
                  className={`flex w-full items-start justify-between gap-3 px-3 py-2 text-left ${
                    isActive
                      ? 'bg-[var(--panel-accent-soft,#f4ede3)] text-[var(--panel-text,#1a120d)]'
                      : 'text-[var(--panel-text-soft,#5b4635)] hover:bg-[var(--panel-surface-muted,#f7f0e7)]'
                  }`}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    insertSuggestion(suggestion.key);
                  }}
                >
                  <div>
                    <div className="text-sm font-medium">{suggestion.label}</div>
                    <div className="text-xs text-[var(--panel-text-muted,#876f5c)]">{suggestion.description}</div>
                  </div>
                  <code className="rounded border border-[var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface-muted,#f7f0e7)] px-2 py-1 text-[11px] text-[var(--panel-accent-ink,#6f3f16)]">
                    {`{{${suggestion.key}}}`}
                  </code>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
