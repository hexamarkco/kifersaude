import type { HTMLAttributes, ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

import { cx } from '../../lib/cx';
import type { PanelTone } from '../panelStyles';

export type BadgeTone =
  | PanelTone
  | 'default'
  | 'primary'
  | 'gold'
  | 'proposal'
  | 'proposal-sent'
  | 'contact'
  | 'new-lead'
  | 'qualified'
  | 'negotiation'
  | 'won'
  | 'lost'
  | 'inactive'
  | 'cold'
  | 'warm'
  | 'hot'
  | 'risk'
  | 'low'
  | 'medium'
  | 'high'
  | 'urgent'
  | 'medium-priority'
  | 'completed'
  | 'in-progress'
  | 'pending'
  | 'canceled'
  | 'cancelled'
  | 'site'
  | 'website'
  | 'referral'
  | 'indication'
  | 'indicacao'
  | 'instagram'
  | 'linkedin'
  | 'email'
  | 'whatsapp'
  | 'phone'
  | 'other'
  | 'person'
  | 'legal-person'
  | 'company'
  | 'small'
  | 'midsize'
  | 'large'
  | 'enterprise'
  | 'technology'
  | 'finance'
  | 'financial'
  | 'health'
  | 'retail'
  | 'education'
  | 'stage-new-lead'
  | 'stage-contact'
  | 'stage-qualified'
  | 'stage-proposal'
  | 'stage-negotiation'
  | 'stage-won'
  | 'stage-lost'
  | 'paid'
  | 'partial'
  | 'overdue'
  | 'call'
  | 'meeting'
  | 'follow-up'
  | 'proposal-task'
  | 'task-pending'
  | 'low-risk'
  | 'medium-risk'
  | 'high-risk'
  | 'client'
  | 'lead'
  | 'opportunity'
  | 'supplier'
  | 'partner'
  | 'active'
  | 'expiring'
  | 'expired'
  | 'suspended'
  | 'renewal'
  | 'vip'
  | 'strategic'
  | 'featured'
  | 'new'
  | 'beta'
  | 'important';
export type BadgeSize = 'xs' | 'sm' | 'md';

export type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: BadgeTone;
  size?: BadgeSize;
  icon?: LucideIcon | ReactNode;
  children: ReactNode;
};

const sizeClasses: Record<BadgeSize, string> = {
  xs: 'px-2 py-0.5 text-[10px]',
  sm: 'px-2 py-0.5 text-[11px]',
  md: 'px-3 py-1.5 text-xs',
};

export default function Badge({ tone = 'neutral', size = 'md', icon, className, children, ...props }: BadgeProps) {
  const Icon = typeof icon === 'function' ? (icon as LucideIcon) : null;

  return (
    <span className={cx('kds-badge', `kds-badge-${tone}`, sizeClasses[size], className)} {...props}>
      {Icon ? <Icon className="h-3.5 w-3.5" aria-hidden="true" /> : (icon as ReactNode)}
      {children}
    </span>
  );
}
