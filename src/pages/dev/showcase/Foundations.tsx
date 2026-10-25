import { IconButton } from '../../../design-system';
import {
  Bell,
  CalendarDays,
  Check,
  ChevronRight,
  HelpCircle,
  FileText,
  Heart,
  LayoutDashboard,
  Mail,
  MessageCircle,
  Pencil,
  Plus,
  Search,
  Settings,
  Trash2,
  Users,
} from 'lucide-react';
import { Heading, Text, Tooltip } from '../../../design-system';
import { CopyValue, SectionIntro, Specimen, UsageNote } from './ShowcaseParts';
import { tokenStyle } from './tokenStyle';

const colors = [
  {
    label: 'Terracota',
    token: '--brand-primary',
    use: 'Ação principal e identidade',
    ink: '--text-on-brand',
  },
  {
    label: 'Canvas',
    token: '--bg-canvas',
    use: 'Fundo da aplicação',
    ink: '--text-primary',
  },
  {
    label: 'Superfície',
    token: '--bg-surface',
    use: 'Cards, campos e painéis',
    ink: '--text-primary',
  },
  {
    label: 'Texto principal',
    token: '--text-primary',
    use: 'Títulos e informação essencial',
    ink: '--bg-canvas',
  },
  {
    label: 'Cobre',
    token: '--accent-copper',
    use: 'Destaques complementares',
    ink: '--text-on-brand',
  },
  {
    label: 'Dourado',
    token: '--accent-gold',
    use: 'Ênfase especial, com parcimônia',
    ink: '--action-accent-text',
  },
];
const semantic = [
  { label: 'Sucesso', token: 'success', copy: 'Operação concluída' },
  { label: 'Atenção', token: 'warning', copy: 'Requer revisão' },
  { label: 'Erro', token: 'danger', copy: 'Ação não concluída' },
  { label: 'Informação', token: 'info', copy: 'Contexto e orientação' },
];
const icons = [
  Search,
  Plus,
  Pencil,
  Trash2,
  Users,
  FileText,
  CalendarDays,
  MessageCircle,
  LayoutDashboard,
  Bell,
  Settings,
  Mail,
  Heart,
  Check,
  HelpCircle,
  ChevronRight,
];
const iconLabels = [
  'Buscar',
  'Adicionar',
  'Editar',
  'Excluir',
  'Pessoas',
  'Contrato',
  'Agenda',
  'Conversa',
  'Dashboard',
  'Notificações',
  'Configurações',
  'E-mail',
  'Cuidado',
  'Confirmar',
  'Ajuda',
  'Avançar',
];

export default function Foundations() {
  return (
    <>
      <SectionIntro number="01" title="Fundamentos visuais">
        Uma identidade acolhedora. Uma linguagem precisa. Os mesmos tokens
        conectam cada detalhe do CRM.
      </SectionIntro>
      <div className="ds-subheading">
        <Heading level={2}>Cor com propósito</Heading>
        <span>Tokens ativos no tema selecionado</span>
      </div>
      <div className="ds-colors">
        {colors.map((color) => (
          <article className="ds-color-card" key={color.token}>
            <div
              className="ds-color-swatch"
              style={{
                ...tokenStyle('background', color.token),
                ...tokenStyle('color', color.ink),
              }}
            >
              <span>Aa</span>
              <span>●</span>
            </div>
            <div className="ds-color-copy">
              <strong>{color.label}</strong>
              <Text>{color.use}</Text>
              <div>
                <code>{color.token}</code>
                <CopyValue value={`var(${color.token})`} label={color.label} />
              </div>
            </div>
          </article>
        ))}
      </div>
      <div className="ds-semantic-colors">
        {semantic.map(({ label, token, copy }) => (
          <div
            key={token}
            style={{
              ...tokenStyle('background', `--${token}-soft`),
              ...tokenStyle('color', `--${token}-text`),
              ...tokenStyle('borderColor', `--${token}-border`),
            }}
          >
            <strong>{label}</strong>
            <span>{copy}</span>
            <code>--{token}-text</code>
          </div>
        ))}
      </div>
      <UsageNote>
        Use cores semânticas de texto sobre superfícies suaves. Status sempre
        combinam cor, nome e contexto. Terracota orienta a ação principal;
        alertas e exclusões usam seus próprios tons.
      </UsageNote>
      <div className="ds-grid">
        <Specimen
          title="Tipografia de marca"
          description="Playfair Display para apresentações editoriais e de marca. Na operação diária, use Inter."
          source="Heading · Typography.tsx / --font-display"
        >
          <div className="ds-type-display">
            Cuidar começa
            <br />
            com clareza.
          </div>
          <Heading family="display" level={2}>
            Visão comercial
          </Heading>
          <Heading family="display" level={3}>
            Próximos passos
          </Heading>
          <span className="ds-caption">
            Títulos · pesos 500 e 600 · entrelinha compacta
          </span>
        </Specimen>
        <Specimen
          title="Tipografia de operação"
          description="Inter para leitura, navegação, controles, valores e tabelas."
          source="Text · Typography.tsx / --font-sans"
        >
          <Heading family="interface" level={2}>
            Visão comercial
          </Heading>
          <Heading family="interface" level={3}>
            Informações do atendimento
          </Heading>
          <Text size="lg" weight="semibold">
            Cada informação no seu lugar.
          </Text>
          <Text>
            Seu atendimento está agendado. Consulte os detalhes e prepare a
            próxima conversa.
          </Text>
          <Text size="sm" tone="secondary">
            Textos de apoio explicam o contexto e o próximo passo.
          </Text>
          <Text size="xs" tone="muted">
            Legendas, datas e informações complementares.
          </Text>
          <div className="ds-type-numbers">
            R$ 12.480<span>0123456789 · números alinhados em tabelas</span>
          </div>
        </Specimen>
        <Specimen
          title="Espaçamento"
          description="Base de 4 px. Proximidade comunica relação; respiro organiza a leitura."
          source="foundation.css · --space-1 até --space-16"
        >
          <div className="ds-spacing">
            {[1, 2, 3, 4, 5, 6, 8, 10, 12, 16].map((step) => (
              <div key={step}>
                <code>--space-{step}</code>
                <span style={tokenStyle('width', `--space-${step}`)} />
                <small>{step * 4} px</small>
              </div>
            ))}
          </div>
        </Specimen>
        <Specimen
          title="Bordas e raios"
          description="Contornos discretos, com raios de 6, 8, 12 e 16 px para superfícies."
          source="foundation.css · --radius-* / --border-*"
        >
          <div className="ds-radius-grid">
            {[
              ['sm', 6],
              ['md', 8],
              ['lg', 12],
              ['xl', 16],
            ].map(([key, px]) => (
              <div
                key={key}
                style={tokenStyle('borderRadius', `--radius-${key}`)}
              >
                <strong>{px} px</strong>
                <code>--radius-{key}</code>
              </div>
            ))}
          </div>
          <div className="ds-border-examples">
            {['subtle', 'default', 'strong'].map((key) => (
              <div
                key={key}
                style={tokenStyle('borderColor', `--border-${key}`)}
              >
                <code>--border-{key}</code>
              </div>
            ))}
          </div>
          <Text className="ds-caption">
            Controles e badges usam também --radius-full, conforme os
            componentes atuais.
          </Text>
        </Specimen>
        <Specimen
          title="Elevação e foco"
          description="Superfícies flat; sombra apenas para separar camadas e indicar interação."
          source="foundation.css / themes.css · --shadow-*"
        >
          <div className="ds-elevations">
            {['card', 'popover', 'modal', 'focus'].map((key) => (
              <div key={key} style={tokenStyle('boxShadow', `--shadow-${key}`)}>
                <code>{key}</code>
              </div>
            ))}
          </div>
        </Specimen>
        <Specimen
          title="Ícones"
          description="Lucide. Traço consistente, significado familiar e rótulos acessíveis."
          source="lucide-react · 16 / 18 / 20 px · strokeWidth 2"
        >
          <div className="ds-icon-grid">
            {icons.map((Icon, index) => (
              <Tooltip key={iconLabels[index]} content={iconLabels[index]}>
                <IconButton variant="ghost" size="sm"
                  className="ds-icon-sample"
                  type="button"
                  aria-label={iconLabels[index]}
                >
                  <Icon size={20} aria-hidden="true" />
                </IconButton>
              </Tooltip>
            ))}
          </div>
          <Text className="ds-caption">
            Ícones complementam os rótulos. Ações somente com ícone precisam de
            nome e tooltip.
          </Text>
        </Specimen>
      </div>
      <details className="ds-technical">
        <summary>Referência técnica dos fundamentos</summary>
        <Text>
          Origem: src/design-system/foundation.css, themes.css e tokens.ts. O
          showcase lê as variáveis do tema; não mantém uma segunda paleta.
          styles.css continua sendo o único entrypoint global.
        </Text>
        <code>
          import {'{ Button, Field, PageHeader }'} from '…/design-system';
        </code>
      </details>
    </>
  );
}
