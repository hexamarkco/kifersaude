import { operatorLandingPages } from '../domain/operatorLandingData';
import type { OperatorLandingContent } from '../domain/types';

export function listOperatorLandingPages(): readonly OperatorLandingContent[] {
  return operatorLandingPages;
}

export function getOperatorLandingBySlug(slug: string | undefined): OperatorLandingContent | null {
  return getOperatorLandingByPath(slug, undefined);
}

export function getOperatorLandingByPath(slug: string | undefined, variantSlug: string | undefined = undefined): OperatorLandingContent | null {
  if (!slug) {
    return null;
  }

  return operatorLandingPages.find((page) => page.slug === slug && page.variantSlug === variantSlug) ?? null;
}

export function getOperatorLandingPath(slug: string): string {
  return `/planos/${slug}`;
}

export function getOperatorQuotePath(slug: string): string {
  return `/?operadora=${encodeURIComponent(slug)}#cotacao`;
}
