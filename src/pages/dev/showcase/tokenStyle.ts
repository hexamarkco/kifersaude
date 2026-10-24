import type { CSSProperties } from 'react';

export function tokenStyle(property: string, token: string): CSSProperties {
  return { [property]: `var(${token})` };
}
