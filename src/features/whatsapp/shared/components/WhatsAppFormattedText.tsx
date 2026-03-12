import { Fragment } from 'react';
import { parseWhatsAppInlineTokens } from '../../../../lib/whatsappTextFormatting';

interface WhatsAppFormattedTextProps {
  text: string;
  className?: string;
}

const renderInlineToken = (tokenType: string, value: string, key: string) => {
  if (tokenType === 'bold') {
    return (
      <strong key={key} className="font-semibold">
        {value}
      </strong>
    );
  }

  if (tokenType === 'italic') {
    return (
      <em key={key} className="italic">
        {value}
      </em>
    );
  }

  if (tokenType === 'strike') {
    return (
      <span key={key} className="line-through">
        {value}
      </span>
    );
  }

  if (tokenType === 'code') {
    return (
      <code key={key} className="rounded bg-black/10 px-1 py-[1px] font-mono text-[0.92em]">
        {value}
      </code>
    );
  }

  return <Fragment key={key}>{value}</Fragment>;
};

export function WhatsAppFormattedText({ text, className = '' }: WhatsAppFormattedTextProps) {
  const lines = text.split('\n');

  return (
    <span className={className}>
      {lines.map((line, lineIndex) => {
        const tokens = parseWhatsAppInlineTokens(line);
        return (
          <Fragment key={`line-${lineIndex}`}>
            {tokens.map((token, tokenIndex) =>
              renderInlineToken(token.type, token.value, `token-${lineIndex}-${tokenIndex}`),
            )}
            {lineIndex < lines.length - 1 && <br />}
          </Fragment>
        );
      })}
    </span>
  );
}
