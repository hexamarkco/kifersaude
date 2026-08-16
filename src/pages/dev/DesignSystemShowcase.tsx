import { useState } from 'react';
import {
  Activity,
  ArrowDownRight,
  ArrowRight,
  BadgePercent,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  DollarSign,
  FileText,
  LayoutGrid,
  List,
  MessageCircle,
  Minus,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Target,
  TrendingUp,
  Users,
} from 'lucide-react';
import './design-system-showcase.css';

const CARD =
  'rounded-[28px] border border-[#ECE5D6] bg-white p-6 sm:p-7 shadow-[0_1px_2px_rgba(24,20,15,0.04)]';

function SectionLabel({ children }: { children: string }) {
  return <p className="mb-5 text-[13px] font-medium text-[#8A8172]">{children}</p>;
}

function SectionHeaderBlock({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="mb-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#E2672E]">{eyebrow}</p>
      <h3 className="mt-1 font-serif text-xl font-medium text-[#18140F]">{title}</h3>
      {description && <p className="mt-1 text-sm text-[#8A8172]">{description}</p>}
    </div>
  );
}

function Checkbox({
  checked,
  indeterminate,
  disabled,
  onClick,
}: {
  checked?: boolean;
  indeterminate?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}) {
  const active = checked || indeterminate;
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-pressed={checked}
      className={[
        'flex h-5 w-5 shrink-0 items-center justify-center rounded-[6px] border transition-colors',
        disabled
          ? active
            ? 'border-[#D9D2C2] bg-[#D9D2C2]'
            : 'border-[#E7DFCF] bg-[#F4F0E7]'
          : active
            ? 'border-[#18140F] bg-[#18140F] cursor-pointer'
            : 'border-[#D8CFBC] bg-white cursor-pointer hover:border-[#18140F]',
      ].join(' ')}
    >
      {checked && <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />}
      {indeterminate && !checked && <Minus className="h-3.5 w-3.5 text-white" strokeWidth={3} />}
    </button>
  );
}

function Radio({
  checked,
  disabled,
  onClick,
}: {
  checked?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-pressed={checked}
      className={[
        'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors',
        disabled
          ? checked
            ? 'border-[#D9D2C2]'
            : 'border-[#E7DFCF]'
          : checked
            ? 'border-[#18140F] cursor-pointer'
            : 'border-[#D8CFBC] cursor-pointer hover:border-[#18140F]',
      ].join(' ')}
    >
      {checked && (
        <span className={['h-2.5 w-2.5 rounded-full', disabled ? 'bg-[#D9D2C2]' : 'bg-[#18140F]'].join(' ')} />
      )}
    </button>
  );
}

function FieldRow({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-3">
      {children}
      <span className="text-sm text-[#3A3226]">{label}</span>
    </div>
  );
}

type Tone = 'neutral' | 'info' | 'warning' | 'accent' | 'success' | 'danger';

const TONE_CLASSES: Record<Tone, string> = {
  neutral: 'bg-[#F0EDE3] text-[#6B6255]',
  info: 'bg-[#E4EEF7] text-[#2C5C86]',
  warning: 'bg-[#FBEEDB] text-[#9C6B12]',
  accent: 'bg-[#FBE3D3] text-[#B84A1D]',
  success: 'bg-[#E3F1E7] text-[#256A3F]',
  danger: 'bg-[#FBE1DE] text-[#B23327]',
};

function StatusPill({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return (
    <span className={['rounded-full px-3 py-1.5 text-xs font-semibold', TONE_CLASSES[tone]].join(' ')}>
      {children}
    </span>
  );
}

const CONTRACT_STATUSES: Array<{ label: string; tone: Tone }> = [
  { label: 'Rascunho', tone: 'neutral' },
  { label: 'Em análise', tone: 'info' },
  { label: 'Documentos pendentes', tone: 'warning' },
  { label: 'Proposta enviada', tone: 'accent' },
  { label: 'Aguardando assinatura', tone: 'accent' },
  { label: 'Emitido', tone: 'info' },
  { label: 'Ativo', tone: 'success' },
  { label: 'Suspenso', tone: 'danger' },
  { label: 'Cancelado', tone: 'danger' },
  { label: 'Encerrado', tone: 'neutral' },
];

const FUNNEL_STAGES = [
  { nome: 'Novo', count: 58, color: '#E2672E' },
  { nome: 'Contato Inicial', count: 41, color: '#D97B3F' },
  { nome: 'Em Análise', count: 27, color: '#C68A4E' },
  { nome: 'Proposta Enviada', count: 18, color: '#B3985E' },
  { nome: 'Negociação', count: 11, color: '#9CA36D' },
  { nome: 'Convertido', count: 7, color: '#5F8F5C' },
];

const LEAD_STATUS_DISTRIBUTION = [
  { label: 'Novo', value: 58, color: '#E2672E' },
  { label: 'Contato Inicial', value: 41, color: '#D97B3F' },
  { label: 'Em Análise', value: 27, color: '#C68A4E' },
  { label: 'Proposta Enviada', value: 18, color: '#B3985E' },
  { label: 'Negociação', value: 11, color: '#9CA36D' },
];

const OPERADORA_DISTRIBUTION = [
  { label: 'Bradesco Saúde', value: 32 },
  { label: 'Amil', value: 24 },
  { label: 'SulAmérica', value: 18 },
  { label: 'Porto Seguro', value: 14 },
  { label: 'Unimed', value: 12 },
];

function DonutChart({ data }: { data: { label: string; value: number; color: string }[] }) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  let acc = 0;
  const stops = data
    .map((d) => {
      const start = (acc / total) * 360;
      acc += d.value;
      const end = (acc / total) * 360;
      return `${d.color} ${start}deg ${end}deg`;
    })
    .join(', ');

  return (
    <div
      className="relative mx-auto flex h-[168px] w-[168px] shrink-0 items-center justify-center rounded-full"
      style={{ background: `conic-gradient(${stops})` }}
    >
      <div className="flex h-[108px] w-[108px] flex-col items-center justify-center rounded-full bg-white text-center">
        <span className="text-2xl font-semibold text-[#18140F]">{total}</span>
        <span className="text-[10px] font-medium uppercase tracking-wide text-[#9C917F]">leads ativos</span>
      </div>
    </div>
  );
}

const METRIC_TABS = ['Leads', 'Contratos', 'Comissões'] as const;

const TREND_BARS = [22, 28, 19, 34, 30, 41, 37, 45, 39, 52, 48, 58];

const OPERADORA_LOGOS = [
  { src: '/amil-logo-1-2.png', alt: 'Amil' },
  { src: '/bradesco-saude-logo-1-1.png', alt: 'Bradesco Saúde' },
  { src: '/sulamerica-saude-logo.png', alt: 'SulAmérica' },
  { src: '/porto-logo.png', alt: 'Porto Seguro' },
  { src: '/assim-saude-logo.png', alt: 'Assim Saúde' },
];

const OPERADORA_TEXT_CHIPS = ['Unimed', 'Hapvida', 'NotreDame Intermédica', 'Golden Cross', 'Prevent Senior'];

const STATUS_DROPDOWN_OPTIONS = [
  { nome: 'Novo', cor: '#E2672E' },
  { nome: 'Contato Inicial', cor: '#D97B3F' },
  { nome: 'Em Análise', cor: '#C68A4E' },
  { nome: 'Proposta Enviada', cor: '#B3985E' },
  { nome: 'Negociação', cor: '#9CA36D' },
];

export default function DesignSystemShowcase() {
  const [accordionOpen, setAccordionOpen] = useState<'q1' | 'q2' | null>('q2');
  const [activeTag, setActiveTag] = useState<'todos' | 'novo'>('todos');
  const [checkChecked, setCheckChecked] = useState(true);
  const [checkUnchecked, setCheckUnchecked] = useState(false);
  const [checkTriState, setCheckTriState] = useState<'checked' | 'indeterminate' | 'unchecked'>('checked');
  const [radioValue, setRadioValue] = useState<'checked' | 'unchecked'>('checked');
  const [sliderValue, setSliderValue] = useState(68);
  const [sliderActive, setSliderActive] = useState(false);
  const [segmentIcon, setSegmentIcon] = useState<'grid' | 'list'>('grid');
  const [segmentIcon2, setSegmentIcon2] = useState<'grid' | 'list'>('list');
  const [metricTab, setMetricTab] = useState(0);
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
  const [statusDropdownValue, setStatusDropdownValue] = useState('Proposta Enviada');

  const sliderCurrency = 800 + Math.round((sliderValue / 100) * 3200);

  return (
    <div className="min-h-screen bg-[#F4F0E7] px-4 py-16 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <h1 className="mb-2 text-center font-serif text-5xl font-medium text-[#18140F] sm:text-6xl">
          Design System
        </h1>
        <p className="mb-14 text-center text-sm text-[#8A8172]">Kifer Saúde · componentes usados no painel</p>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-12">
          {/* Buttons */}
          <div className={[CARD, 'sm:col-span-7'].join(' ')}>
            <SectionLabel>Buttons</SectionLabel>
            <div className="flex flex-wrap items-center gap-3">
              <button className="rounded-full bg-[#18140F] px-7 py-3 text-sm font-medium text-white transition hover:opacity-90">
                Novo Lead
              </button>
              <button className="rounded-full border border-[#18140F] bg-white px-7 py-3 text-sm font-medium text-[#18140F] transition hover:bg-[#F4F0E7]">
                Cancelar
              </button>
              <button
                aria-label="Expandir"
                className="flex h-11 w-11 items-center justify-center rounded-full bg-[#ECE3D3] text-[#18140F] transition hover:bg-[#E2D9C6]"
              >
                <ChevronDown className="h-4 w-4" />
              </button>
              <button
                aria-label="Filtrar"
                className="flex h-11 w-11 items-center justify-center rounded-full bg-[#ECE3D3] text-[#18140F] transition hover:bg-[#E2D9C6]"
              >
                <SlidersHorizontal className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button className="rounded-full bg-[#ECE3D3] px-7 py-3 text-sm font-medium text-[#3A3226] transition hover:bg-[#E2D9C6]">
                Exportar
              </button>
              <button className="rounded-full bg-[#ECE3D3] px-5 py-2.5 text-sm font-medium text-[#3A3226] transition hover:bg-[#E2D9C6]">
                Filtrar
              </button>
              <button className="rounded-full bg-[#18140F] px-5 py-2.5 text-sm font-medium text-white transition hover:opacity-90">
                Salvar
              </button>
              <button
                aria-label="Avançar"
                className="ml-auto flex h-11 w-11 items-center justify-center rounded-full bg-[#ECE3D3] text-[#18140F] transition hover:bg-[#E2D9C6]"
              >
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Tags & Badges */}
          <div className={[CARD, 'sm:col-span-5'].join(' ')}>
            <SectionLabel>Tags &amp; Badges</SectionLabel>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setActiveTag('todos')}
                className={[
                  'rounded-full px-4 py-2 text-sm font-semibold transition',
                  activeTag === 'todos' ? 'bg-[#E2672E] text-white' : 'bg-[#F4F0E7] text-[#3A3226]',
                ].join(' ')}
              >
                Todos
              </button>
              <button
                onClick={() => setActiveTag('novo')}
                className={[
                  'rounded-full px-4 py-2 text-xs font-bold uppercase tracking-wide transition',
                  activeTag === 'novo' ? 'bg-[#E2672E] text-white' : 'bg-[#3A3630] text-white',
                ].join(' ')}
              >
                Novo
              </button>
              <button className="flex items-center gap-1 rounded-full bg-[#ECE3D3] px-4 py-2 text-sm font-medium text-[#3A3226]">
                Operadora
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <button className="flex items-center gap-1.5 text-sm font-medium text-[#3A3226] hover:text-[#18140F]">
                Limpar filtros
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#E7DFCF] text-[10px]">
                  ✕
                </span>
              </button>
              <span className="rounded-full bg-[#F0EDE3] px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-[#3A3226]">
                Instagram
              </span>
              <span className="rounded-full bg-[#F0EDE3] px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-[#3A3226]">
                Indicação
              </span>
            </div>
          </div>

          {/* Bread + Bullets */}
          <div className="flex flex-col gap-5 sm:col-span-5">
            <div className={CARD}>
              <SectionLabel>Bread</SectionLabel>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-[#8A8172]">Painel · Leads</span>
                <span className="text-[#C9BFA9]">·</span>
                <span className="rounded-full bg-[#F4F0E7] px-3 py-1.5 font-medium text-[#18140F]">
                  Ana Paula Costa
                </span>
              </div>
            </div>
            <div className={CARD}>
              <SectionLabel>Bullets</SectionLabel>
              <div className="flex items-center gap-2.5 rounded-2xl bg-[#F4F0E7] px-4 py-3">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-[#18140F]" />
                <span className="text-sm font-medium text-[#18140F]">Documentação completa</span>
              </div>
            </div>
          </div>

          {/* Accordion */}
          <div className={[CARD, 'sm:col-span-7'].join(' ')}>
            <SectionLabel>Accordion</SectionLabel>
            <div className="flex flex-col gap-3">
              <div className="rounded-2xl border border-[#ECE5D6] px-5 py-4">
                <button
                  className="flex w-full items-center justify-between gap-3 text-left"
                  onClick={() => setAccordionOpen(accordionOpen === 'q1' ? null : 'q1')}
                >
                  <span className="font-serif text-lg font-medium text-[#18140F]">
                    MEI pode contratar plano empresarial?
                  </span>
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#F4F0E7] text-[#18140F]">
                    {accordionOpen === 'q1' ? <Minus className="h-3.5 w-3.5" /> : <span className="text-base leading-none">+</span>}
                  </span>
                </button>
                <div className={['ds-accordion-panel', accordionOpen === 'q1' ? 'is-open' : ''].join(' ')}>
                  <div>
                    <p className="pt-3 text-sm leading-relaxed text-[#6B6255]">
                      Sim. Quando existe <span className="font-semibold text-[#E2672E]">CNPJ ativo</span> e
                      enquadramento aceito pela operadora, o MEI pode acessar produtos empresariais com condição
                      mais competitiva do que muitos planos individuais.
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-[#ECE5D6] px-5 py-4">
                <button
                  className="flex w-full items-center justify-between gap-3 text-left"
                  onClick={() => setAccordionOpen(accordionOpen === 'q2' ? null : 'q2')}
                >
                  <span className="font-serif text-lg font-medium text-[#18140F]">Tem carência?</span>
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#18140F] text-white">
                    {accordionOpen === 'q2' ? <Minus className="h-3.5 w-3.5" /> : <span className="text-base leading-none">+</span>}
                  </span>
                </button>
                <div className={['ds-accordion-panel', accordionOpen === 'q2' ? 'is-open' : ''].join(' ')}>
                  <div>
                    <p className="pt-3 text-sm leading-relaxed text-[#6B6255]">
                      Tem, e ela varia conforme a{' '}
                      <span className="font-semibold text-[#E2672E]">operadora</span>, o tipo de contratação e a
                      regra do produto. Antes da contratação, a Kifer explica o que muda para{' '}
                      <span className="font-semibold text-[#E2672E]">consultas, exames, internações e urgência</span>.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Spinners */}
          <div className={[CARD, 'flex flex-col sm:col-span-3'].join(' ')}>
            <SectionLabel>Spinners</SectionLabel>
            <div className="flex flex-1 flex-col items-center justify-center gap-6">
              <div className="h-9 w-9 animate-spin rounded-full border-[3px] border-[#F0EDE3] border-t-[#18140F]" />
              <div className="h-9 w-9 animate-spin rounded-full border-[3px] border-[#18140F] border-t-[#F0EDE3]" />
            </div>
          </div>

          {/* Checkboxes */}
          <div className={[CARD, 'sm:col-span-5'].join(' ')}>
            <SectionLabel>Checkboxes</SectionLabel>
            <div className="mb-5 flex items-center gap-3">
              <Checkbox
                checked={checkTriState === 'checked'}
                indeterminate={checkTriState === 'indeterminate'}
                onClick={() =>
                  setCheckTriState((v) => (v === 'checked' ? 'indeterminate' : v === 'indeterminate' ? 'unchecked' : 'checked'))
                }
              />
              <Checkbox indeterminate onClick={() => setCheckTriState('indeterminate')} />
              <Checkbox checked={false} onClick={() => setCheckTriState('unchecked')} />
            </div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-4">
              <FieldRow label="Checked">
                <Checkbox checked={checkChecked} onClick={() => setCheckChecked((v) => !v)} />
              </FieldRow>
              <FieldRow label="Disabled Checked">
                <Checkbox checked disabled />
              </FieldRow>
              <FieldRow label="Unchecked">
                <Checkbox checked={checkUnchecked} onClick={() => setCheckUnchecked((v) => !v)} />
              </FieldRow>
              <FieldRow label="Disabled Unchecked">
                <Checkbox disabled />
              </FieldRow>
            </div>
          </div>

          {/* Radios */}
          <div className={[CARD, 'sm:col-span-4'].join(' ')}>
            <SectionLabel>Radios</SectionLabel>
            <div className="mb-5 flex items-center gap-3">
              <Radio checked onClick={() => {}} />
              <Radio checked={false} onClick={() => {}} />
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-4">
              <FieldRow label="Checked">
                <Radio checked={radioValue === 'checked'} onClick={() => setRadioValue('checked')} />
              </FieldRow>
              <FieldRow label="Disabled Checked">
                <Radio checked disabled />
              </FieldRow>
              <FieldRow label="Unchecked">
                <Radio checked={radioValue === 'unchecked'} onClick={() => setRadioValue('unchecked')} />
              </FieldRow>
              <FieldRow label="Disabled Unchecked">
                <Radio disabled />
              </FieldRow>
            </div>
          </div>

          {/* Text Inputs */}
          <div className={[CARD, 'sm:col-span-7'].join(' ')}>
            <SectionLabel>Text Inputs</SectionLabel>
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3 rounded-full border border-[#18140F] py-2 pl-5 pr-2">
                <Search className="h-4 w-4 shrink-0 text-[#8A8172]" />
                <input
                  defaultValue="Buscar leads por nome ou telefone"
                  className="w-full bg-transparent text-sm text-[#18140F] outline-none placeholder:text-[#8A8172]"
                />
                <button className="flex shrink-0 items-center gap-1 rounded-full bg-[#ECE3D3] px-4 py-2 text-sm font-medium text-[#3A3226]">
                  Status
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="flex items-center gap-3 rounded-full border border-[#18140F] py-2 pl-5 pr-2">
                <Search className="h-4 w-4 shrink-0 text-[#8A8172]" />
                <input
                  defaultValue="Buscar contratos por código"
                  className="w-full bg-transparent text-sm text-[#18140F] outline-none placeholder:text-[#8A8172]"
                />
                <button
                  aria-label="Filtrar"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#ECE3D3] text-[#18140F]"
                >
                  <SlidersHorizontal className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-1 flex flex-col gap-3 sm:flex-row">
                <button className="flex flex-1 items-center justify-between rounded-2xl bg-[#F4F0E7] px-4 py-3.5 text-left text-sm text-[#8A8172]">
                  Operadora
                  <ChevronDown className="h-4 w-4" />
                </button>
                <input
                  placeholder="Nome do responsável"
                  className="flex-1 rounded-2xl bg-[#F4F0E7] px-4 py-3.5 text-sm text-[#18140F] outline-none placeholder:text-[#8A8172]"
                />
              </div>
            </div>
          </div>

          {/* Info blocks + Sliders */}
          <div className="flex flex-col gap-5 sm:col-span-5">
            <div className={CARD}>
              <SectionLabel>Info blocks</SectionLabel>
              <div className="flex items-start gap-3 rounded-2xl bg-[#F4F0E7] p-4">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#18140F]">
                  <Check className="h-3 w-3 text-white" strokeWidth={3} />
                </span>
                <p className="text-sm leading-relaxed text-[#3A3226]">
                  A carência varia conforme a operadora, o tipo de contratação e a regra do produto. Antes de
                  contratar, explicamos o que muda para consultas, exames, internações e urgência.
                </p>
              </div>
            </div>
            <div className={CARD}>
              <SectionLabel>Sliders</SectionLabel>
              <div className="relative pt-8">
                {sliderActive && (
                  <span
                    className="absolute -top-1 flex -translate-x-1/2 items-center rounded-lg bg-[#18140F] px-2.5 py-1 text-[11px] font-medium text-white"
                    style={{ left: `${sliderValue}%` }}
                  >
                    R$ {sliderCurrency.toLocaleString('pt-BR')}
                  </span>
                )}
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={sliderValue}
                  onChange={(e) => setSliderValue(Number(e.target.value))}
                  onPointerDown={() => setSliderActive(true)}
                  onPointerUp={() => setSliderActive(false)}
                  className="ds-slider"
                  style={{ ['--ds-slider-fill' as string]: `${sliderValue}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-[#9C917F]">Faixa de mensalidade</p>
            </div>
          </div>

          {/* Cells */}
          <div className={[CARD, 'flex flex-col gap-3 sm:col-span-6'].join(' ')}>
            <SectionLabel>Cells</SectionLabel>
            <div className="flex items-center gap-3 rounded-2xl border border-[#ECE5D6] p-3">
              <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#F4F0E7]">
                <MessageCircle className="h-5 w-5 text-[#18140F]" />
                <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border-2 border-white bg-[#E2672E]" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-[#18140F]">Nova mensagem no WhatsApp</p>
                <p className="text-[11px] font-medium tracking-wide text-[#9C917F]">Carlos Eduardo Silva · agora</p>
              </div>
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#ECE3D3]">
                <ArrowRight className="h-4 w-4 text-[#18140F]" />
              </span>
            </div>

            <div className="flex items-center gap-3 rounded-2xl border border-[#ECE5D6] p-3">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#E7B93D] to-[#C6501F] text-sm font-semibold text-white">
                AP
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-[#18140F]">Ana Paula Costa</p>
                <div className="mt-0.5 flex items-center gap-1.5">
                  <StatusPill tone="accent">Proposta Enviada</StatusPill>
                </div>
                <p className="mt-1 text-[11px] text-[#9C917F]">São Paulo, SP · resp. Luiza</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-sm font-semibold text-[#18140F]">R$ 340</p>
                <p className="text-[10px] text-[#9C917F]">comissão</p>
              </div>
            </div>
          </div>

          {/* Segmented Controls */}
          <div className={[CARD, 'flex flex-col gap-4 sm:col-span-3'].join(' ')}>
            <SectionLabel>Segmented Controls</SectionLabel>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 rounded-full bg-[#F4F0E7] p-1">
                <button
                  onClick={() => setSegmentIcon('grid')}
                  className={[
                    'flex h-9 w-9 items-center justify-center rounded-full transition',
                    segmentIcon === 'grid' ? 'bg-[#18140F] text-white' : 'text-[#8A8172]',
                  ].join(' ')}
                >
                  <LayoutGrid className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setSegmentIcon('list')}
                  className={[
                    'flex h-9 w-9 items-center justify-center rounded-full transition',
                    segmentIcon === 'list' ? 'bg-[#18140F] text-white' : 'text-[#8A8172]',
                  ].join(' ')}
                >
                  <List className="h-4 w-4" />
                </button>
              </div>
              <div className="flex items-center gap-1 rounded-full bg-[#F4F0E7] p-1">
                <button
                  onClick={() => setSegmentIcon2('grid')}
                  className={[
                    'flex h-9 w-9 items-center justify-center rounded-full transition',
                    segmentIcon2 === 'grid' ? 'bg-[#18140F] text-white' : 'text-[#8A8172]',
                  ].join(' ')}
                >
                  <LayoutGrid className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setSegmentIcon2('list')}
                  className={[
                    'flex h-9 w-9 items-center justify-center rounded-full transition',
                    segmentIcon2 === 'list' ? 'bg-[#18140F] text-white' : 'text-[#8A8172]',
                  ].join(' ')}
                >
                  <List className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="flex items-center gap-1 rounded-full bg-[#F4F0E7] p-1">
              {METRIC_TABS.map((label, i) => (
                <button
                  key={label}
                  onClick={() => setMetricTab(i)}
                  className={[
                    'flex-1 rounded-full px-3 py-2 text-xs font-medium transition',
                    metricTab === i ? 'bg-[#18140F] text-white' : 'text-[#3A3226]',
                  ].join(' ')}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Profile image */}
          <div className={[CARD, 'flex flex-col items-center justify-center gap-4 sm:col-span-3'].join(' ')}>
            <SectionLabel>Profile image</SectionLabel>
            <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-[#E7B93D] to-[#C6501F] text-xl font-semibold text-white">
              LR
              <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-[#3CA65B]" />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-[#18140F]">Luiza Ramos</p>
              <p className="text-xs text-[#9C917F]">Consultora · online</p>
            </div>
          </div>

          {/* --- Painel · Dashboard --- */}
          <div className="sm:col-span-12">
            <div className="mt-4 mb-1 flex items-center gap-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#B3A88F]">
                Painel · Dashboard
              </p>
              <div className="h-px flex-1 bg-[#E7DFCF]" />
            </div>
          </div>

          {/* KPI cards */}
          <div className="grid grid-cols-1 gap-5 sm:col-span-12 sm:grid-cols-2 lg:grid-cols-5">
            {[
              { icon: Users, title: 'Leads em negociação', subtitle: 'Base de leads', value: '23 / 58', trend: 'Pipeline ativo' },
              { icon: FileText, title: 'Contratos ativos', subtitle: 'Vigentes', value: '142', trend: 'Carteira atual' },
              { icon: DollarSign, title: 'Comissão', subtitle: 'Mensal', value: 'R$ 18.420,00', trend: 'Previsão de receita' },
              { icon: Target, title: 'Taxa de eficiência', subtitle: 'Leads convertidos', value: '34%', trend: 'Conversão atual' },
              { icon: Activity, title: 'Ticket médio', subtitle: 'Por contrato', value: 'R$ 389,90', trend: 'Valor da carteira' },
            ].map((kpi) => (
              <div key={kpi.title} className={CARD}>
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#FBE3D3] text-[#E2672E]">
                    <kpi.icon className="h-3.5 w-3.5" />
                  </span>
                  <p className="text-sm font-semibold text-[#18140F]">{kpi.title}</p>
                </div>
                <p className="mt-1 text-xs font-medium text-[#9C917F]">{kpi.subtitle}</p>
                <p className="mt-3 text-2xl font-semibold tracking-tight text-[#18140F]">{kpi.value}</p>
                <p className="mt-2 text-xs font-medium text-[#B3A88F]">{kpi.trend}</p>
              </div>
            ))}
          </div>

          {/* Hero / motivational card */}
          <div className={[CARD, 'sm:col-span-12'].join(' ')}>
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#B3A88F]">
                  Motivação do dia
                </p>
                <h3 className="mt-1 font-serif text-xl font-medium text-[#18140F]">Continue crescendo!</h3>
                <p className="mt-1 text-sm text-[#8A8172]">
                  Mantenha seu pipeline ativo e acompanhe suas métricas em tempo real.
                </p>
              </div>
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#FBE3D3] text-[#E2672E]">
                <TrendingUp className="h-5 w-5" strokeWidth={1.75} />
              </div>
            </div>
          </div>

          {/* Lead funnel */}
          <div className={[CARD, 'sm:col-span-12'].join(' ')}>
            <SectionHeaderBlock
              eyebrow="Panorama"
              title="Funil comercial"
              description="Leitura do pipeline ativo e da conversão entre etapas."
            />
            <div className="grid gap-6 lg:grid-cols-[minmax(12rem,0.6fr)_minmax(0,1fr)] lg:items-center">
              <div className="mx-auto flex w-full max-w-sm flex-col items-center gap-1.5">
                {FUNNEL_STAGES.map((stage) => {
                  const widest = FUNNEL_STAGES[0].count;
                  const width = Math.max(30, (stage.count / widest) * 100);
                  return (
                    <div
                      key={stage.nome}
                      className="h-8 transition-[width] duration-500"
                      style={{
                        width: `${width}%`,
                        clipPath: 'polygon(4% 0%, 96% 0%, 88% 100%, 12% 100%)',
                        background: stage.color,
                      }}
                      title={`${stage.nome}: ${stage.count}`}
                    />
                  );
                })}
              </div>
              <div className="space-y-2.5">
                {FUNNEL_STAGES.map((stage, i) => {
                  const prev = FUNNEL_STAGES[i - 1];
                  const conversion = prev ? Math.round((stage.count / prev.count) * 100) : 100;
                  const widest = FUNNEL_STAGES[0].count;
                  return (
                    <div key={stage.nome} className="rounded-2xl bg-[#F4F0E7] px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-2.5">
                          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: stage.color }} />
                          <span className="truncate text-sm font-semibold text-[#18140F]">{stage.nome}</span>
                        </div>
                        <div className="flex shrink-0 items-center gap-2 text-xs font-semibold text-[#6B6255]">
                          {i > 0 && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5">
                              <ArrowDownRight className="h-3 w-3" />
                              {conversion}%
                            </span>
                          )}
                          <span className="tabular-nums">{stage.count}</span>
                        </div>
                      </div>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#E7DFCF]">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${(stage.count / widest) * 100}%`, background: stage.color }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Distribution: donut + operadoras */}
          <div className={[CARD, 'sm:col-span-6'].join(' ')}>
            <SectionHeaderBlock
              eyebrow="Analytics"
              title="Distribuição de leads por status"
              description="Mapa de concentração por etapa do funil ativo."
            />
            <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center">
              <DonutChart data={LEAD_STATUS_DISTRIBUTION} />
              <div className="w-full min-w-0 space-y-2.5">
                {LEAD_STATUS_DISTRIBUTION.map((item) => {
                  const total = LEAD_STATUS_DISTRIBUTION.reduce((s, d) => s + d.value, 0);
                  const pct = Math.round((item.value / total) * 100);
                  return (
                    <div key={item.label} className="flex items-center gap-2.5">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: item.color }} />
                      <span className="min-w-0 flex-1 truncate text-sm font-medium text-[#3A3226]">{item.label}</span>
                      <span className="text-xs font-semibold text-[#9C917F]">{pct}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className={[CARD, 'sm:col-span-6'].join(' ')}>
            <SectionHeaderBlock
              eyebrow="Analytics"
              title="Contratos por operadora"
              description="Participação das operadoras na carteira vigente."
            />
            <div className="space-y-3">
              {OPERADORA_DISTRIBUTION.map((item) => (
                <div key={item.label}>
                  <div className="mb-1.5 flex items-center justify-between text-sm">
                    <span className="font-medium text-[#3A3226]">{item.label}</span>
                    <span className="font-semibold text-[#9C917F]">{item.value}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-[#F0EDE3]">
                    <div className="h-full rounded-full bg-[#E2672E]" style={{ width: `${item.value}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Trend section: tabs + insight cards + bar chart */}
          <div className={[CARD, 'sm:col-span-12'].join(' ')}>
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <SectionHeaderBlock
                eyebrow="Analytics"
                title="Evolução mensal"
                description="Tendência por mês considerando o período selecionado."
              />
              <div className="flex items-center gap-1 rounded-full bg-[#F4F0E7] p-1">
                {METRIC_TABS.map((label, i) => (
                  <button
                    key={label}
                    onClick={() => setMetricTab(i)}
                    className={[
                      'rounded-full px-4 py-2 text-xs font-medium transition',
                      metricTab === i ? 'bg-[#18140F] text-white' : 'text-[#3A3226]',
                    ].join(' ')}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid gap-4 lg:grid-cols-[0.8fr_1.6fr]">
              <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
                {[
                  { icon: TrendingUp, label: 'Último mês', value: '58', caption: '+12,3% vs mês anterior' },
                  { icon: BadgePercent, label: 'Média do período', value: '37', caption: 'Baseado nos últimos 12 meses' },
                  { icon: Calendar, label: 'Pico do período', value: '58', caption: 'Agosto foi o melhor mês' },
                ].map((card) => (
                  <div key={card.label} className="rounded-2xl bg-[#F4F0E7] p-4">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white text-[#E2672E]">
                        <card.icon className="h-4 w-4" />
                      </span>
                      <span className="text-xs font-semibold text-[#6B6255]">{card.label}</span>
                    </div>
                    <p className="mt-3 text-xl font-semibold text-[#18140F]">{card.value}</p>
                    <p className="mt-1 text-xs font-medium text-[#9C917F]">{card.caption}</p>
                  </div>
                ))}
              </div>
              <div className="flex items-end gap-2 rounded-2xl bg-[#F4F0E7] p-4">
                {TREND_BARS.map((v, i) => (
                  <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
                    <div
                      className="w-full rounded-t-md bg-[#E2672E]"
                      style={{ height: `${(v / Math.max(...TREND_BARS)) * 130}px`, opacity: 0.35 + (v / Math.max(...TREND_BARS)) * 0.65 }}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Contract status */}
          <div className={[CARD, 'sm:col-span-7'].join(' ')}>
            <SectionLabel>Status de contrato</SectionLabel>
            <div className="flex flex-wrap gap-2">
              {CONTRACT_STATUSES.map((s) => (
                <StatusPill key={s.label} tone={s.tone}>
                  {s.label}
                </StatusPill>
              ))}
            </div>

            <div className="mt-6">
              <p className="mb-3 text-[13px] font-medium text-[#8A8172]">Status dropdown</p>
              <div className="relative inline-block">
                <button
                  onClick={() => setStatusDropdownOpen((v) => !v)}
                  className="flex items-center gap-2 rounded-full bg-[#F4F0E7] px-4 py-2 text-sm font-medium text-[#3A3226]"
                >
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{
                      background: STATUS_DROPDOWN_OPTIONS.find((o) => o.nome === statusDropdownValue)?.cor,
                    }}
                  />
                  {statusDropdownValue}
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
                {statusDropdownOpen && (
                  <div className="absolute left-0 top-full z-10 mt-2 w-56 rounded-2xl border border-[#ECE5D6] bg-white p-1.5 shadow-[0_16px_40px_rgba(24,20,15,0.12)]">
                    {STATUS_DROPDOWN_OPTIONS.map((option) => (
                      <button
                        key={option.nome}
                        onClick={() => {
                          setStatusDropdownValue(option.nome);
                          setStatusDropdownOpen(false);
                        }}
                        className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-[#3A3226] hover:bg-[#F4F0E7]"
                      >
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: option.cor }} />
                        {option.nome}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Alerts */}
          <div className={[CARD, 'flex flex-col gap-3 sm:col-span-5'].join(' ')}>
            <SectionLabel>Alerts</SectionLabel>
            <div className="flex items-start justify-between gap-3 rounded-2xl bg-[#FBE1DE] p-4">
              <div className="flex items-start gap-2.5">
                <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-[#B23327]" />
                <p className="text-sm text-[#8A2E24]">Não foi possível carregar os dados. Tente novamente.</p>
              </div>
              <button className="flex shrink-0 items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-[#B23327]">
                <RefreshCw className="h-3.5 w-3.5" />
                Tentar novamente
              </button>
            </div>
            <div className="flex items-start gap-2.5 rounded-2xl bg-[#FBEEDB] p-4">
              <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-[#9C6B12]" />
              <p className="text-sm text-[#8A5F10]">
                Preencha as datas de início e fim no formato DD/MM/AAAA para visualizar o período personalizado.
              </p>
            </div>
          </div>

          {/* Operadoras */}
          <div className={[CARD, 'sm:col-span-12'].join(' ')}>
            <SectionLabel>Operadoras</SectionLabel>
            <div className="flex flex-wrap items-center gap-3">
              {OPERADORA_LOGOS.map((logo) => (
                <div
                  key={logo.alt}
                  className="flex h-12 items-center justify-center rounded-2xl border border-[#ECE5D6] bg-white px-5"
                >
                  <img src={logo.src} alt={logo.alt} className="h-6 w-auto object-contain sm:h-7" />
                </div>
              ))}
              {OPERADORA_TEXT_CHIPS.map((name) => (
                <span
                  key={name}
                  className="flex h-12 items-center rounded-2xl border border-[#ECE5D6] bg-white px-5 text-sm font-medium text-[#3A3226]"
                >
                  {name}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-10 flex justify-center">
          <button className="rounded-full bg-[#ECE3D3] px-6 py-3 text-sm font-medium text-[#3A3226] transition hover:bg-[#E2D9C6]">
            And more...
          </button>
        </div>
      </div>
    </div>
  );
}
