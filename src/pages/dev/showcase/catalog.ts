import {
  BookOpen,
  Boxes,
  CheckCircle2,
  LayoutTemplate,
  MonitorSmartphone,
  Palette,
} from 'lucide-react';

export const sections = [
  {
    id: 'overview',
    label: 'Visão geral',
    icon: BookOpen,
    description: 'Princípios, identidade Terracota e visão do sistema',
  },
  {
    id: 'foundations',
    label: 'Fundamentos visuais',
    icon: Palette,
    description:
      'Cores tokens paleta tipografia Playfair Inter espaçamentos bordas raios sombras ícones',
  },
  {
    id: 'components',
    label: 'Componentes',
    icon: Boxes,
    description:
      'Botões inputs selects máscaras checkbox radio switch calendário datepicker badges tabelas cards menus abas filtros modais drawers alertas toast tooltip popover avatar',
  },
  {
    id: 'states',
    label: 'Estados e validação',
    icon: CheckCircle2,
    description:
      'Hover focus disabled loading sucesso erro vazio validação skeleton acessibilidade',
  },
  {
    id: 'patterns',
    label: 'Padrões de layout',
    icon: LayoutTemplate,
    description:
      'Dashboard listagem detalhes criação edição formulário cabeçalho ações salvar cancelar busca navegação',
  },
  {
    id: 'responsive',
    label: 'Responsividade',
    icon: MonitorSmartphone,
    description:
      'Desktop tablet mobile exemplos interativos viewport adaptações',
  },
] as const;

export type SectionId = (typeof sections)[number]['id'];
export type ShowcaseTheme = 'light' | 'dark';
export const componentGroups = [
  { id: 'actions', label: 'Ações' },
  { id: 'forms', label: 'Formulários' },
  { id: 'navigation', label: 'Navegação' },
  { id: 'data', label: 'Dados' },
  { id: 'feedback', label: 'Feedback' },
  { id: 'overlays', label: 'Interações' },
  { id: 'application', label: 'Aplicação' },
] as const;
export type ComponentGroup = (typeof componentGroups)[number]['id'];
export const patterns = [
  { id: 'list', label: 'Listagem' },
  { id: 'detail', label: 'Detalhes' },
  { id: 'create', label: 'Criação' },
  { id: 'edit', label: 'Edição' },
  { id: 'dashboard', label: 'Dashboard' },
] as const;
export type Pattern = (typeof patterns)[number]['id'];

export function isSection(value: string): value is SectionId {
  return sections.some((section) => section.id === value);
}
export function isPattern(value: string): value is Pattern {
  return patterns.some((pattern) => pattern.id === value);
}
export function normalizeSearch(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .trim();
}
