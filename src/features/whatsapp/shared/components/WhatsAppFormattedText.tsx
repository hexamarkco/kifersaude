import { Fragment } from 'react';
import {
  parseWhatsAppBlocks,
  type WhatsAppBlock,
  type WhatsAppInlineTokenType,
} from '../../../../lib/whatsappTextFormatting';

interface WhatsAppFormattedTextProps {
  text: string;
  className?: string;
}

const renderInlineToken = (tokenType: WhatsAppInlineTokenType, value: string, key: string) => {
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

const renderLine = (line: { type: WhatsAppInlineTokenType; value: string }[], blockKey: string) =>
  line.map((token, tokenIndex) =>
    renderInlineToken(token.type, token.value, `${blockKey}-token-${tokenIndex}`),
  );

const renderLines = (lines: { type: WhatsAppInlineTokenType; value: string }[][], blockKey: string) =>
  lines.map((line, lineIndex) => (
    <Fragment key={`${blockKey}-line-${lineIndex}`}>
      {renderLine(line, `${blockKey}-${lineIndex}`)}
      {lineIndex < lines.length - 1 && <br />}
    </Fragment>
  ));

const renderBlock = (block: WhatsAppBlock, blockIndex: number) => {
  const blockKey = `block-${blockIndex}`;

  if (block.type === 'quote') {
    return (
      <div
        key={blockKey}
        className="comm-card rounded-r-xl rounded-l-md border-l-2 border-[var(--panel-focus,#c86f1d)] bg-[var(--panel-surface-soft,#f4ede3)] px-3 py-2 text-[0.98em]"
      >
        {renderLines(block.lines, blockKey)}
      </div>
    );
  }

  if (block.type === 'list') {
    return (
      <ul key={blockKey} className="ml-5 list-disc space-y-1">
        {block.items.map((item, itemIndex) => (
          <li key={`${blockKey}-item-${itemIndex}`}>{renderLine(item, `${blockKey}-${itemIndex}`)}</li>
        ))}
      </ul>
    );
  }

  const isEmptyParagraph =
    block.lines.length === 1 &&
    block.lines[0]?.length === 1 &&
    block.lines[0]?.[0]?.type === 'text' &&
    block.lines[0]?.[0]?.value === '';

  if (isEmptyParagraph) {
    return (
      <div key={blockKey} aria-hidden="true" className="h-4">
        <br />
      </div>
    );
  }

  return <div key={blockKey}>{renderLines(block.lines, blockKey)}</div>;
};

export function WhatsAppFormattedText({ text, className = '' }: WhatsAppFormattedTextProps) {
  const blocks = parseWhatsAppBlocks(text);

  return (
    <div className={className}>
      {blocks.map((block, blockIndex) => renderBlock(block, blockIndex))}
    </div>
  );
}
