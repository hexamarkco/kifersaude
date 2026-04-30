import type { HTMLAttributes } from 'react';

import { cx } from '../../lib/cx';
import {
  panelCardBaseClass,
  panelCardPaddingClasses,
  panelCardVariantClasses,
  type PanelCardPadding,
  type PanelCardVariant,
} from '../tokens';

export type CardVariant = PanelCardVariant;
export type CardPadding = PanelCardPadding;

export type CardProps = HTMLAttributes<HTMLDivElement> & {
  variant?: CardVariant;
  padding?: CardPadding;
};

export default function Card({
  variant = 'default',
  padding = 'md',
  className,
  children,
  ...props
}: CardProps) {
  return (
    <div className={cx(panelCardBaseClass, panelCardVariantClasses[variant], panelCardPaddingClasses[padding], className)} {...props}>
      {children}
    </div>
  );
}
