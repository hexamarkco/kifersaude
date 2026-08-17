import { useEffect, useState, type ReactNode } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  Bold,
  Bookmark,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  DollarSign,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  Filter,
  Folder,
  GripVertical,
  Home,
  Image as ImageIcon,
  Italic,
  LayoutGrid,
  List,
  ListOrdered,
  Loader2,
  Mail,
  MapPin,
  MessageCircle,
  Minus,
  Moon,
  Music,
  Pause,
  Pencil,
  Play,
  Plus,
  Search,
  Settings,
  Share2,
  Sliders as SlidersIcon,
  SlidersHorizontal,
  Sparkles,
  Sun,
  Trash2,
  Underline,
  Upload,
  User,
  Users,
  X,
} from 'lucide-react';

import {
  Alert,
  Avatar,
  AvatarBadge,
  AvatarGroup,
  Badge,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  Button,
  ButtonGroup,
  Card,
  Checkbox,
  ConfirmDialog,
  DateTimePicker,
  Dialog,
  DialogBody,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Drawer,
  DrawerBody,
  DrawerFooter,
  DrawerHeader,
  EmptyState,
  Field,
  IconButton,
  Input,
  InputAddon,
  InputGroup,
  KpiCard,
  LoadingState,
  OperationalMetricChip,
  OperationalStatusBadge,
  OperationalStatusDot,
  Pagination,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Progress,
  Radio,
  RadioGroup,
  SearchInput,
  Select,
  Skeleton,
  Stepper,
  Surface,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tabs,
  Textarea,
  ToastProvider,
  Tooltip,
  useToast,
} from '../../design-system';
import FilterMultiSelect from '../../components/FilterMultiSelect';
import './design-system-showcase.css';

type Theme = 'light' | 'dark';
const THEME_STORAGE_KEY = 'kifer-ds-showcase-theme';

/* ── Layout helpers ─────────────────────────────────────────── */

function Cat({ id, title, description, children }: { id: string; title: string; description: string; children: ReactNode }) {
  return (
    <section id={id} className="mb-16 scroll-mt-8">
      <div className="mb-6 border-b border-[var(--border-default)] pb-4">
        <h2 className="font-[var(--font-display)] text-3xl font-semibold text-[var(--text-primary)]">{title}</h2>
        <p className="mt-1 text-sm text-[var(--text-muted)]">{description}</p>
      </div>
      <div className="ds-cat-grid">{children}</div>
    </section>
  );
}

function Item({
  title,
  span,
  children,
}: {
  title: string;
  span?: 'sm' | 'md' | 'lg' | 'full';
  children: ReactNode;
}) {
  const spanClass =
    span === 'full'
      ? 'sm:col-span-full'
      : span === 'lg'
        ? 'sm:col-span-2 xl:col-span-3'
        : span === 'md'
          ? 'sm:col-span-2'
          : '';
  return (
    <div className={['ds-item-card flex flex-col gap-4', spanClass].join(' ')}>
      <p className="text-[13px] font-medium text-[var(--text-muted)]">{title}</p>
      <div className="flex flex-1 flex-col justify-center gap-3">{children}</div>
    </div>
  );
}

function ThemeToggle({ theme, onChange }: { theme: Theme; onChange: (t: Theme) => void }) {
  return (
    <div className="fixed right-4 top-4 z-50 flex items-center gap-1 rounded-full border border-[var(--border-default)] bg-[var(--bg-surface)] p-1 shadow-[var(--shadow-popover)]">
      <button
        type="button"
        aria-label="Modo claro"
        aria-pressed={theme === 'light'}
        onClick={() => onChange('light')}
        className={[
          'flex h-8 w-8 items-center justify-center rounded-full transition',
          theme === 'light' ? 'bg-[var(--text-primary)] text-[var(--text-inverse)]' : 'text-[var(--text-muted)]',
        ].join(' ')}
      >
        <Sun className="h-4 w-4" />
      </button>
      <button
        type="button"
        aria-label="Modo escuro"
        aria-pressed={theme === 'dark'}
        onClick={() => onChange('dark')}
        className={[
          'flex h-8 w-8 items-center justify-center rounded-full transition',
          theme === 'dark' ? 'bg-[var(--text-primary)] text-[var(--text-inverse)]' : 'text-[var(--text-muted)]',
        ].join(' ')}
      >
        <Moon className="h-4 w-4" />
      </button>
    </div>
  );
}

function CatNav() {
  const cats = [
    ['actions', 'Actions'],
    ['forms', 'Forms'],
    ['navigation', 'Navigation'],
    ['containers', 'Containers'],
    ['feedback', 'Feedback'],
    ['data', 'Data Display'],
    ['media', 'Media'],
    ['search', 'Search & Filters'],
    ['advanced', 'Advanced'],
    ['layout', 'Layout / Utility'],
  ] as const;
  return (
    <nav className="mb-12 flex flex-wrap justify-center gap-2">
      {cats.map(([id, label]) => (
        <a
          key={id}
          href={`#${id}`}
          className="rounded-full bg-[var(--bg-hover)] px-3.5 py-1.5 text-xs font-medium text-[var(--text-secondary)] transition hover:bg-[var(--bg-active)] hover:text-[var(--text-primary)]"
        >
          {label}
        </a>
      ))}
    </nav>
  );
}

/* ── Data ─────────────────────────────────────────── */

const STATUS_DROPDOWN_OPTIONS = [
  { nome: 'Novo', cor: 'var(--brand-primary)' },
  { nome: 'Contato Inicial', cor: '#d97b3f' },
  { nome: 'Em Análise', cor: '#c68a4e' },
  { nome: 'Proposta Enviada', cor: '#b3985e' },
];

/* ── Page ─────────────────────────────────────────── */

function ShowcaseContent() {
  const { toast } = useToast();

  const [accordionOpen, setAccordionOpen] = useState<'q1' | 'q2' | null>('q2');
  const [checkTri, setCheckTri] = useState<'checked' | 'indeterminate' | 'unchecked'>('checked');
  const [switchOn, setSwitchOn] = useState(true);
  const [radioValue, setRadioValue] = useState('checked');
  const [sliderValue, setSliderValue] = useState(68);
  const [sliderActive, setSliderActive] = useState(false);
  const [rangeLow, setRangeLow] = useState(20);
  const [rangeHigh, setRangeHigh] = useState(70);
  const [segmentIcon, setSegmentIcon] = useState<'grid' | 'list'>('grid');
  const [metricTab, setMetricTab] = useState<'leads' | 'contratos' | 'comissoes'>('leads');
  const [underlineTab, setUnderlineTab] = useState<'leads' | 'contratos' | 'comissoes'>('leads');
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
  const [statusDropdownValue, setStatusDropdownValue] = useState('Proposta Enviada');
  const [page, setPage] = useState(3);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [alertDialogOpen, setAlertDialogOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [tagsInput, setTagsInput] = useState(['Bradesco Saúde', 'Amil']);
  const [colorValue, setColorValue] = useState('#e2672e');
  const [otp, setOtp] = useState(['4', '2', '', '', '', '']);
  const [toggleGridPressed, setToggleGridPressed] = useState(true);
  const [selectedTreeOpen, setSelectedTreeOpen] = useState(true);

  const sliderCurrency = 800 + Math.round((sliderValue / 100) * 3200);

  return (
    <div className="min-h-screen bg-[var(--bg-canvas)] px-4 py-16 sm:px-8">
      <div className="mx-auto max-w-7xl">
        <h1 className="mb-2 text-center font-[var(--font-display)] text-5xl font-medium text-[var(--text-primary)] sm:text-6xl">
          Design System
        </h1>
        <p className="mb-8 text-center text-sm text-[var(--text-muted)]">
          Kifer Saúde · biblioteca completa de componentes, por categoria
        </p>

        <CatNav />

        {/* ═══════════════════ ACTIONS ═══════════════════ */}
        <Cat id="actions" title="Actions" description="Botões e controles de ação.">
          <Item title="Button">
            <div className="flex flex-wrap gap-2">
              <Button variant="primary">Novo Lead</Button>
              <Button variant="secondary">Cancelar</Button>
              <Button variant="tertiary">Filtrar</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="danger">Excluir</Button>
              <Button loading>Salvando</Button>
            </div>
          </Item>

          <Item title="Icon Button">
            <div className="flex flex-wrap gap-2">
              <IconButton aria-label="Configurações" variant="secondary">
                <Settings className="h-4 w-4" />
              </IconButton>
              <IconButton aria-label="Filtrar" variant="tertiary">
                <SlidersHorizontal className="h-4 w-4" />
              </IconButton>
              <IconButton aria-label="Avançar" variant="primary">
                <ArrowRight className="h-4 w-4" />
              </IconButton>
            </div>
          </Item>

          <Item title="Button Group">
            <ButtonGroup>
              <Button variant="ghost" size="sm">
                Dia
              </Button>
              <Button variant="ghost" size="sm">
                Semana
              </Button>
              <Button variant="ghost" size="sm">
                Mês
              </Button>
            </ButtonGroup>
          </Item>

          <Item title="Split Button">
            <div className="flex w-fit overflow-hidden rounded-full border border-[var(--text-primary)]">
              <button className="bg-[var(--text-primary)] px-5 py-2.5 text-sm font-medium text-[var(--text-inverse)]">
                Salvar
              </button>
              <button
                aria-label="Mais opções"
                className="flex items-center justify-center border-l border-[var(--text-inverse)]/20 bg-[var(--text-primary)] px-3 text-[var(--text-inverse)]"
              >
                <ChevronDown className="h-4 w-4" />
              </button>
            </div>
          </Item>

          <Item title="Floating Action Button">
            <button className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--text-primary)] text-[var(--text-inverse)] shadow-[var(--shadow-modal)]">
              <Plus className="h-6 w-6" />
            </button>
          </Item>

          <Item title="Link">
            <a href="#actions" className="inline-flex items-center gap-1 text-sm font-medium text-[var(--brand-primary)] underline underline-offset-4">
              Ver todos os contratos
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </Item>

          <Item title="Toggle Button">
            <div className="flex gap-2">
              <button
                aria-pressed={toggleGridPressed}
                onClick={() => setToggleGridPressed((v) => !v)}
                className={[
                  'flex h-9 w-9 items-center justify-center rounded-full border transition',
                  toggleGridPressed
                    ? 'border-[var(--text-primary)] bg-[var(--text-primary)] text-[var(--text-inverse)]'
                    : 'border-[var(--border-strong)] text-[var(--text-secondary)]',
                ].join(' ')}
              >
                <Bookmark className="h-4 w-4" />
              </button>
              <span className="self-center text-xs text-[var(--text-muted)]">
                {toggleGridPressed ? 'Salvo' : 'Salvar lead'}
              </span>
            </div>
          </Item>

          <Item title="Segmented Control">
            <div className="flex items-center gap-1 rounded-full bg-[var(--bg-hover)] p-1">
              <button
                onClick={() => setSegmentIcon('grid')}
                className={[
                  'flex h-9 w-9 items-center justify-center rounded-full transition',
                  segmentIcon === 'grid' ? 'bg-[var(--text-primary)] text-[var(--text-inverse)]' : 'text-[var(--text-muted)]',
                ].join(' ')}
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button
                onClick={() => setSegmentIcon('list')}
                className={[
                  'flex h-9 w-9 items-center justify-center rounded-full transition',
                  segmentIcon === 'list' ? 'bg-[var(--text-primary)] text-[var(--text-inverse)]' : 'text-[var(--text-muted)]',
                ].join(' ')}
              >
                <List className="h-4 w-4" />
              </button>
            </div>
          </Item>
        </Cat>

        {/* ═══════════════════ FORMS ═══════════════════ */}
        <Cat id="forms" title="Forms" description="Campos e controles de entrada de dados.">
          <Item title="Input">
            <Input placeholder="Nome do responsável" leftIcon={User} />
          </Item>

          <Item title="Textarea">
            <Textarea placeholder="Observações sobre o lead" rows={3} />
          </Item>

          <Item title="Search Input">
            <SearchInput placeholder="Buscar leads por nome ou telefone" />
          </Item>

          <Item title="Number Input">
            <Input type="number" placeholder="0" leftIcon={DollarSign} defaultValue={340} />
          </Item>

          <Item title="Password Input">
            <Input
              type={passwordVisible ? 'text' : 'password'}
              placeholder="********"
              leftIcon={undefined}
              defaultValue="segredo123"
              action={
                <button type="button" onClick={() => setPasswordVisible((v) => !v)} className="text-[var(--text-muted)]">
                  {passwordVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              }
            />
          </Item>

          <Item title="OTP Input">
            <div className="flex gap-2">
              {otp.map((digit, i) => (
                <input
                  key={i}
                  value={digit}
                  onChange={(e) => setOtp((prev) => prev.map((d, idx) => (idx === i ? e.target.value.slice(-1) : d)))}
                  maxLength={1}
                  className="h-11 w-9 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)] text-center text-lg font-semibold text-[var(--text-primary)] outline-none focus:border-[var(--brand-primary)]"
                />
              ))}
            </div>
          </Item>

          <Item title="Select">
            <Select
              placeholder="Operadora"
              options={[
                { value: 'bradesco', label: 'Bradesco Saúde' },
                { value: 'amil', label: 'Amil' },
                { value: 'sulamerica', label: 'SulAmérica' },
              ]}
            />
          </Item>

          <Item title="Multi Select">
            <FilterMultiSelect
              icon={Users}
              placeholder="Responsáveis"
              values={['luiza']}
              onChange={() => {}}
              options={[
                { value: 'luiza', label: 'Luiza' },
                { value: 'nick', label: 'Nick' },
              ]}
            />
          </Item>

          <Item title="Combobox">
            <div className="relative">
              <Input placeholder="Buscar operadora..." leftIcon={Search} defaultValue="Brad" />
              <div className="absolute left-0 right-0 top-full z-10 mt-1.5 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-1.5 shadow-[var(--shadow-popover)]">
                <div className="rounded-xl bg-[var(--bg-hover)] px-3 py-2 text-sm text-[var(--text-primary)]">
                  <strong>Brad</strong>esco Saúde
                </div>
              </div>
            </div>
          </Item>

          <Item title="Autocomplete">
            <div className="relative">
              <Input placeholder="Buscar cidade..." leftIcon={MapPin} defaultValue="São" />
              <div className="absolute left-0 right-0 top-full z-10 mt-1.5 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-1.5 shadow-[var(--shadow-popover)]">
                <div className="rounded-xl px-3 py-2 text-sm text-[var(--text-secondary)]"><strong className="text-[var(--text-primary)]">São</strong> Paulo, SP</div>
                <div className="rounded-xl px-3 py-2 text-sm text-[var(--text-secondary)]"><strong className="text-[var(--text-primary)]">São</strong> Bernardo, SP</div>
              </div>
            </div>
          </Item>

          <Item title="Checkbox">
            <div className="flex items-center gap-3">
              <Checkbox checked={checkTri === 'checked'} onChange={() => setCheckTri('checked')} />
              <Checkbox ref={(el) => el && (el.indeterminate = checkTri === 'indeterminate')} onChange={() => setCheckTri('indeterminate')} />
              <Checkbox checked={false} onChange={() => setCheckTri('unchecked')} />
              <Checkbox disabled checked />
            </div>
          </Item>

          <Item title="Radio">
            <RadioGroup name="ds-radio-demo" value={radioValue} onValueChange={setRadioValue} orientation="horizontal">
              <Radio value="checked" label="Ativo" />
              <Radio value="unchecked" label="Inativo" />
            </RadioGroup>
          </Item>

          <Item title="Switch">
            <Switch checked={switchOn} onChange={() => setSwitchOn((v) => !v)} label="Notificações por WhatsApp" />
          </Item>

          <Item title="Slider">
            <div className="relative pt-8">
              {sliderActive && (
                <span
                  className="absolute -top-1 flex -translate-x-1/2 items-center rounded-lg bg-[var(--text-primary)] px-2.5 py-1 text-[11px] font-medium text-[var(--text-inverse)]"
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
          </Item>

          <Item title="Range Slider">
            <div className="relative pt-2">
              <div className="relative h-1.5 rounded-full bg-[var(--border-default)]">
                <div
                  className="absolute h-1.5 rounded-full bg-[var(--text-primary)]"
                  style={{ left: `${rangeLow}%`, right: `${100 - rangeHigh}%` }}
                />
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={rangeLow}
                onChange={(e) => setRangeLow(Math.min(Number(e.target.value), rangeHigh - 5))}
                className="ds-slider absolute inset-x-0 top-2 !bg-none"
              />
              <input
                type="range"
                min={0}
                max={100}
                value={rangeHigh}
                onChange={(e) => setRangeHigh(Math.max(Number(e.target.value), rangeLow + 5))}
                className="ds-slider absolute inset-x-0 top-2 !bg-none"
              />
              <p className="mt-4 text-xs text-[var(--text-muted)]">
                R$ {(rangeLow * 40).toLocaleString('pt-BR')} — R$ {(rangeHigh * 40).toLocaleString('pt-BR')}
              </p>
            </div>
          </Item>

          <Item title="Date Picker">
            <DateTimePicker type="date" defaultValue="2026-08-16" />
          </Item>

          <Item title="Date Range Picker">
            <div className="flex items-center gap-2">
              <DateTimePicker type="date" defaultValue="2026-08-01" />
              <span className="text-[var(--text-muted)]">–</span>
              <DateTimePicker type="date" defaultValue="2026-08-31" />
            </div>
          </Item>

          <Item title="Time Picker">
            <DateTimePicker type="time" defaultValue="09:00" />
          </Item>

          <Item title="File Upload">
            <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-[var(--border-strong)] px-4 py-6 text-center">
              <Upload className="h-5 w-5 text-[var(--text-muted)]" />
              <p className="text-sm text-[var(--text-secondary)]">Arraste um arquivo ou clique para enviar</p>
              <p className="text-xs text-[var(--text-muted)]">PDF, JPG até 10MB</p>
            </div>
          </Item>

          <Item title="Tags Input">
            <div className="flex flex-wrap items-center gap-1.5 rounded-2xl border border-[var(--border-strong)] bg-[var(--bg-surface)] p-2">
              {tagsInput.map((tag) => (
                <span key={tag} className="flex items-center gap-1 rounded-full bg-[var(--bg-hover)] px-2.5 py-1 text-xs font-medium text-[var(--text-primary)]">
                  {tag}
                  <button onClick={() => setTagsInput((prev) => prev.filter((t) => t !== tag))}>
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              <input placeholder="Adicionar..." className="min-w-[6rem] flex-1 bg-transparent px-1 text-sm outline-none" />
            </div>
          </Item>

          <Item title="Color Picker">
            <div className="flex items-center gap-2">
              {['#e2672e', '#d4af37', '#256a3f', '#2c5c86', '#18140f'].map((c) => (
                <button
                  key={c}
                  onClick={() => setColorValue(c)}
                  className={['h-7 w-7 rounded-full ring-offset-2 ring-offset-[var(--bg-surface)]', colorValue === c ? 'ring-2 ring-[var(--text-primary)]' : ''].join(' ')}
                  style={{ background: c }}
                />
              ))}
            </div>
          </Item>

          <Item title="Input Group">
            <InputGroup>
              <InputAddon>https://</InputAddon>
              <Input defaultValue="kifersaude.com.br" className="rounded-l-none" />
            </InputGroup>
          </Item>

          <Item title="Form Field">
            <Field label="E-mail" description="Usado para notificações do sistema">
              <Input type="email" leftIcon={Mail} placeholder="voce@kifersaude.com.br" />
            </Field>
          </Item>

          <Item title="Form Validation">
            <Field label="CPF" error="CPF inválido, verifique os números.">
              <Input state="error" defaultValue="123.456.789-00" />
            </Field>
          </Item>
        </Cat>

        {/* ═══════════════════ NAVIGATION ═══════════════════ */}
        <Cat id="navigation" title="Navigation" description="Estruturas de navegação e orientação.">
          <Item title="Navbar" span="md">
            <div className="flex items-center justify-between rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] px-4 py-3">
              <span className="font-[var(--font-display)] text-lg font-semibold text-[var(--text-primary)]">Kifer Saúde</span>
              <div className="flex items-center gap-4 text-sm text-[var(--text-secondary)]">
                <span>Dashboard</span>
                <span>Leads</span>
                <span>Contratos</span>
              </div>
              <Avatar name="Luiza Ramos" size="sm" />
            </div>
          </Item>

          <Item title="Sidebar">
            <div className="flex w-16 flex-col items-center gap-3 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] py-4">
              {[Home, Users, FileText, Settings].map((Icon, i) => (
                <span
                  key={i}
                  className={[
                    'flex h-9 w-9 items-center justify-center rounded-xl',
                    i === 0 ? 'bg-[var(--text-primary)] text-[var(--text-inverse)]' : 'text-[var(--text-muted)]',
                  ].join(' ')}
                >
                  <Icon className="h-4 w-4" />
                </span>
              ))}
            </div>
          </Item>

          <Item title="Navigation Rail">
            <div className="flex w-14 flex-col items-center gap-4 rounded-2xl bg-[var(--bg-hover)] py-3">
              {[Home, Bell, User].map((Icon, i) => (
                <Icon key={i} className={['h-4 w-4', i === 0 ? 'text-[var(--brand-primary)]' : 'text-[var(--text-muted)]'].join(' ')} />
              ))}
            </div>
          </Item>

          <Item title="Bottom Navigation">
            <div className="flex items-center justify-around rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] px-2 py-2.5">
              {[Home, Search, Bell, User].map((Icon, i) => (
                <Icon key={i} className={['h-4 w-4', i === 0 ? 'text-[var(--brand-primary)]' : 'text-[var(--text-muted)]'].join(' ')} />
              ))}
            </div>
          </Item>

          <Item title="Tabs (pill)">
            <Tabs
              variant="pill"
              items={[
                { id: 'leads', label: 'Leads' },
                { id: 'contratos', label: 'Contratos' },
                { id: 'comissoes', label: 'Comissões' },
              ]}
              value={metricTab}
              onChange={setMetricTab}
            />
          </Item>

          <Item title="Tabs (underline)">
            <Tabs
              variant="underline"
              items={[
                { id: 'leads', label: 'Leads' },
                { id: 'contratos', label: 'Contratos' },
                { id: 'comissoes', label: 'Comissões' },
              ]}
              value={underlineTab}
              onChange={setUnderlineTab}
            />
          </Item>

          <Item title="Breadcrumbs">
            <Breadcrumb>
              <BreadcrumbItem>
                <BreadcrumbLink onClick={() => {}}>Painel</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink onClick={() => {}}>Leads</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem isCurrent>Ana Paula Costa</BreadcrumbItem>
            </Breadcrumb>
          </Item>

          <Item title="Pagination">
            <Pagination currentPage={page} totalPages={12} onPageChange={setPage} />
          </Item>

          <Item title="Stepper" span="md">
            <Stepper
              currentStep={1}
              steps={[
                { label: 'Dados do lead' },
                { label: 'Operadora' },
                { label: 'Documentos' },
                { label: 'Revisão' },
              ]}
            />
          </Item>

          <Item title="Menu / Dropdown Menu">
            <Popover open={menuOpen} onOpenChange={setMenuOpen}>
              <PopoverTrigger>
                <Button variant="secondary">
                  Ações
                  <ChevronDown className="ml-1 h-3.5 w-3.5" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-48 p-1.5">
                <button className="kds-dropdown-option flex w-full items-center gap-2 px-3 py-2 text-left text-sm">
                  <Pencil className="h-3.5 w-3.5" />
                  Editar
                </button>
                <button className="kds-dropdown-option flex w-full items-center gap-2 px-3 py-2 text-left text-sm">
                  <Share2 className="h-3.5 w-3.5" />
                  Compartilhar
                </button>
                <button className="kds-dropdown-option flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[var(--danger-text)]">
                  <Trash2 className="h-3.5 w-3.5" />
                  Excluir
                </button>
              </PopoverContent>
            </Popover>
          </Item>

          <Item title="Context Menu">
            <div className="relative rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-1.5">
              <p className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Lead: Ana Paula</p>
              <button className="kds-dropdown-option flex w-full items-center gap-2 px-3 py-2 text-left text-sm">
                <Copy className="h-3.5 w-3.5" />
                Copiar telefone
              </button>
              <button className="kds-dropdown-option is-selected flex w-full items-center gap-2 px-3 py-2 text-left text-sm">
                <MessageCircle className="h-3.5 w-3.5" />
                Abrir WhatsApp
              </button>
            </div>
          </Item>

          <Item title="Command Palette" span="md">
            <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-2 shadow-[var(--shadow-popover)]">
              <div className="flex items-center gap-2 border-b border-[var(--border-subtle)] px-2 pb-2">
                <Search className="h-4 w-4 text-[var(--text-muted)]" />
                <span className="text-sm text-[var(--text-muted)]">Buscar leads, contratos, ações...</span>
              </div>
              <div className="mt-1.5 space-y-0.5">
                <div className="kds-dropdown-option is-selected flex items-center justify-between px-3 py-2 text-sm">
                  <span>Ir para Leads</span>
                  <span className="text-xs text-[var(--text-muted)]">G L</span>
                </div>
                <div className="kds-dropdown-option flex items-center justify-between px-3 py-2 text-sm">
                  <span>Criar novo contrato</span>
                  <span className="text-xs text-[var(--text-muted)]">⌘ N</span>
                </div>
              </div>
            </div>
          </Item>
        </Cat>

        {/* ═══════════════════ CONTAINERS ═══════════════════ */}
        <Cat id="containers" title="Containers" description="Superfícies que agrupam e organizam conteúdo.">
          <Item title="Card">
            <Card padding="sm">
              <p className="text-sm font-semibold text-[var(--text-primary)]">Ana Paula Costa</p>
              <p className="mt-1 text-xs text-[var(--text-muted)]">São Paulo, SP · resp. Luiza</p>
            </Card>
          </Item>

          <Item title="Panel (Surface)">
            <Surface variant="muted" padding="sm">
              <p className="text-sm text-[var(--text-secondary)]">Painel neutro para agrupar conteúdo secundário.</p>
            </Surface>
          </Item>

          <Item title="Accordion" span="md">
            <div className="flex flex-col gap-2">
              <div className="rounded-2xl border border-[var(--border-default)] px-4 py-3">
                <button
                  className="flex w-full items-center justify-between text-left"
                  onClick={() => setAccordionOpen(accordionOpen === 'q1' ? null : 'q1')}
                >
                  <span className="text-sm font-medium text-[var(--text-primary)]">MEI pode contratar plano empresarial?</span>
                  <Plus className="h-4 w-4 text-[var(--text-muted)]" />
                </button>
                <div className={['ds-accordion-panel', accordionOpen === 'q1' ? 'is-open' : ''].join(' ')}>
                  <div>
                    <p className="pt-2 text-sm text-[var(--text-secondary)]">Sim, com CNPJ ativo e enquadramento aceito pela operadora.</p>
                  </div>
                </div>
              </div>
              <div className="rounded-2xl border border-[var(--border-default)] px-4 py-3">
                <button
                  className="flex w-full items-center justify-between text-left"
                  onClick={() => setAccordionOpen(accordionOpen === 'q2' ? null : 'q2')}
                >
                  <span className="text-sm font-medium text-[var(--text-primary)]">Tem carência?</span>
                  <Minus className="h-4 w-4 text-[var(--text-muted)]" />
                </button>
                <div className={['ds-accordion-panel', accordionOpen === 'q2' ? 'is-open' : ''].join(' ')}>
                  <div>
                    <p className="pt-2 text-sm text-[var(--text-secondary)]">Varia por operadora, tipo de contratação e regra do produto.</p>
                  </div>
                </div>
              </div>
            </div>
          </Item>

          <Item title="Collapsible">
            <button onClick={() => setSelectedTreeOpen((v) => !v)} className="flex w-full items-center gap-2 text-left text-sm font-medium text-[var(--text-primary)]">
              <ChevronRight className={['h-4 w-4 transition-transform', selectedTreeOpen ? 'rotate-90' : ''].join(' ')} />
              Detalhes do contrato
            </button>
            {selectedTreeOpen && <p className="mt-2 pl-6 text-sm text-[var(--text-secondary)]">Código KF-2026-0114 · Ativo desde 12/03/2026</p>}
          </Item>

          <Item title="Drawer">
            <Button variant="secondary" onClick={() => setDrawerOpen(true)}>
              Abrir drawer
            </Button>
            <Drawer side="right" open={drawerOpen} onOpenChange={setDrawerOpen}>
              <DrawerHeader className="flex items-center justify-between">
                <p className="kds-dialog-title">Detalhes do lead</p>
                <button type="button" onClick={() => setDrawerOpen(false)} className="text-[var(--text-muted)]">
                  <X className="h-5 w-5" />
                </button>
              </DrawerHeader>
              <DrawerBody>
                <p className="text-sm text-[var(--text-secondary)]">Ana Paula Costa · São Paulo, SP</p>
              </DrawerBody>
              <DrawerFooter>
                <Button variant="ghost" onClick={() => setDrawerOpen(false)}>Fechar</Button>
              </DrawerFooter>
            </Drawer>
          </Item>

          <Item title="Sheet">
            <Button variant="secondary" onClick={() => setSheetOpen(true)}>
              Abrir sheet
            </Button>
            <Drawer side="bottom" open={sheetOpen} onOpenChange={setSheetOpen}>
              <DrawerHeader className="flex items-center justify-between">
                <p className="kds-dialog-title">Ações rápidas</p>
                <button type="button" onClick={() => setSheetOpen(false)} className="text-[var(--text-muted)]">
                  <X className="h-5 w-5" />
                </button>
              </DrawerHeader>
              <DrawerBody>
                <p className="text-sm text-[var(--text-secondary)]">Ligar, enviar WhatsApp ou agendar follow-up.</p>
              </DrawerBody>
            </Drawer>
          </Item>

          <Item title="Modal / Dialog">
            <Button variant="secondary" onClick={() => setDialogOpen(true)}>
              Abrir modal
            </Button>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen} size="sm">
              <DialogHeader onClose={() => setDialogOpen(false)}>
                <DialogTitle>Novo lembrete</DialogTitle>
              </DialogHeader>
              <DialogBody>
                <Field label="Título">
                  <Input placeholder="Ligar para Ana Paula" />
                </Field>
              </DialogBody>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                <Button variant="primary" onClick={() => setDialogOpen(false)}>Criar</Button>
              </DialogFooter>
            </Dialog>
          </Item>

          <Item title="Alert Dialog">
            <Button variant="danger" onClick={() => setAlertDialogOpen(true)}>
              Excluir lead
            </Button>
            <ConfirmDialog
              open={alertDialogOpen}
              onOpenChange={setAlertDialogOpen}
              onConfirm={() => setAlertDialogOpen(false)}
              title="Excluir este lead?"
              description="Essa ação não pode ser desfeita."
              destructive
              closeOnConfirm
            />
          </Item>

          <Item title="Popover">
            <Popover open={statusDropdownOpen} onOpenChange={setStatusDropdownOpen}>
              <PopoverTrigger>
                <button className="flex items-center gap-2 rounded-full bg-[var(--bg-hover)] px-4 py-2 text-sm font-medium text-[var(--text-secondary)]">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ background: STATUS_DROPDOWN_OPTIONS.find((o) => o.nome === statusDropdownValue)?.cor }}
                  />
                  {statusDropdownValue}
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-52 p-1.5">
                {STATUS_DROPDOWN_OPTIONS.map((option) => (
                  <button
                    key={option.nome}
                    onClick={() => {
                      setStatusDropdownValue(option.nome);
                      setStatusDropdownOpen(false);
                    }}
                    className="kds-dropdown-option flex w-full items-center gap-2 px-3 py-2 text-left text-sm"
                  >
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: option.cor }} />
                    {option.nome}
                  </button>
                ))}
              </PopoverContent>
            </Popover>
          </Item>
        </Cat>

        {/* ═══════════════════ FEEDBACK ═══════════════════ */}
        <Cat id="feedback" title="Feedback" description="Comunicação de estado, status e resultado.">
          <Item title="Alert" span="md">
            <div className="flex flex-col gap-2">
              <Alert tone="danger">Não foi possível carregar os dados. Tente novamente.</Alert>
              <Alert tone="warning">Preencha as datas de início e fim para continuar.</Alert>
            </div>
          </Item>

          <Item title="Banner" span="md">
            <div className="flex items-center justify-between rounded-2xl bg-[var(--brand-primary-soft)] px-4 py-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-[var(--brand-primary)]" />
                <p className="text-sm text-[var(--text-primary)]">Novo design system disponível em todo o painel.</p>
              </div>
              <Button size="sm" variant="ghost">Ver mais</Button>
            </div>
          </Item>

          <Item title="Toast / Snackbar">
            <div className="flex gap-2">
              <Button
                variant="secondary"
                onClick={() => toast({ title: 'Lead atualizado', description: 'Ana Paula Costa movida para Proposta Enviada.', variant: 'success' })}
              >
                Disparar toast
              </Button>
              <Button
                variant="ghost"
                onClick={() => toast({ description: 'Lembrete criado.', variant: 'default' })}
              >
                Snackbar
              </Button>
            </div>
          </Item>

          <Item title="Badge">
            <div className="flex flex-wrap gap-2">
              <Badge tone="accent">Proposta</Badge>
              <Badge tone="success">Ativo</Badge>
              <Badge tone="warning">Pendente</Badge>
              <Badge tone="danger">Perdido</Badge>
              <Badge tone="neutral">Rascunho</Badge>
            </div>
          </Item>

          <Item title="Status Badge">
            <div className="flex flex-wrap gap-2">
              <OperationalStatusBadge statusColor="var(--brand-primary)">Novo</OperationalStatusBadge>
              <OperationalStatusBadge statusColor="#256a3f">Convertido</OperationalStatusBadge>
              <OperationalStatusDot statusColor="var(--brand-primary)" />
            </div>
          </Item>

          <Item title="Chip">
            <div className="flex flex-wrap gap-2">
              <span className="flex items-center gap-1.5 rounded-full bg-[var(--bg-hover)] px-3 py-1.5 text-xs font-medium text-[var(--text-primary)]">
                Instagram
                <X className="h-3 w-3" />
              </span>
              <OperationalMetricChip icon={<Users className="h-3.5 w-3.5" />} value="23" label="leads" tone="accent" active />
            </div>
          </Item>

          <Item title="Tag">
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-[var(--bg-hover)] px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-[var(--text-secondary)]">
                Indicação
              </span>
            </div>
          </Item>

          <Item title="Tooltip">
            <Tooltip content="Enviar mensagem no WhatsApp">
              <button className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--bg-hover)] text-[var(--text-primary)]">
                <MessageCircle className="h-4 w-4" />
              </button>
            </Tooltip>
          </Item>

          <Item title="Progress Bar">
            <Progress value={68} showLabel />
          </Item>

          <Item title="Circular Progress">
            <svg viewBox="0 0 36 36" className="h-14 w-14 -rotate-90">
              <circle cx="18" cy="18" r="15.5" fill="none" stroke="var(--border-default)" strokeWidth="3" />
              <circle
                cx="18"
                cy="18"
                r="15.5"
                fill="none"
                stroke="var(--brand-primary)"
                strokeWidth="3"
                strokeDasharray={`${2 * Math.PI * 15.5}`}
                strokeDashoffset={`${2 * Math.PI * 15.5 * (1 - 0.68)}`}
                strokeLinecap="round"
              />
            </svg>
          </Item>

          <Item title="Spinner">
            <div className="flex gap-4">
              <Loader2 className="h-6 w-6 animate-spin text-[var(--text-primary)]" />
              <div className="h-6 w-6 animate-spin rounded-full border-[3px] border-[var(--border-default)] border-t-[var(--text-primary)]" />
            </div>
          </Item>

          <Item title="Skeleton">
            <div className="flex flex-col gap-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          </Item>

          <Item title="Empty / Error / Success State" span="lg">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <EmptyState icon={<Folder className="h-5 w-5" />} title="Nenhum lead" description="Ajuste os filtros para ver resultados." />
              <EmptyState icon={<AlertTriangle className="h-5 w-5 text-[var(--danger-text)]" />} title="Erro ao carregar" description="Tente novamente em instantes." />
              <EmptyState icon={<CheckCircle2 className="h-5 w-5 text-[var(--success-text)]" />} title="Tudo certo" description="Contrato enviado com sucesso." />
            </div>
          </Item>

          <Item title="Loading State">
            <LoadingState label="Carregando leads" compact />
          </Item>
        </Cat>

        {/* ═══════════════════ DATA DISPLAY ═══════════════════ */}
        <Cat id="data" title="Data Display" description="Exibição estruturada de dados e métricas.">
          <Item title="Table / Data Grid" span="lg">
            <Table size="sm">
              <TableHeader>
                <TableRow>
                  <TableHead>Lead</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead align="right">Comissão</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell>Ana Paula Costa</TableCell>
                  <TableCell><Badge tone="accent">Proposta</Badge></TableCell>
                  <TableCell align="right">R$ 340</TableCell>
                </TableRow>
                <TableRow selected>
                  <TableCell>Carlos Eduardo Silva</TableCell>
                  <TableCell><Badge tone="success">Convertido</Badge></TableCell>
                  <TableCell align="right">R$ 512</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </Item>

          <Item title="List / List Item">
            <ul className="flex flex-col gap-1.5">
              {['Ana Paula Costa', 'Carlos Eduardo Silva', 'Fernanda Oliveira'].map((name) => (
                <li key={name} className="flex items-center gap-2 rounded-xl px-2 py-1.5 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-hover)]">
                  <Avatar name={name} size="xs" />
                  {name}
                </li>
              ))}
            </ul>
          </Item>

          <Item title="Description List">
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
              <dt className="text-[var(--text-muted)]">Operadora</dt>
              <dd className="text-[var(--text-primary)]">Bradesco Saúde</dd>
              <dt className="text-[var(--text-muted)]">Modalidade</dt>
              <dd className="text-[var(--text-primary)]">PME</dd>
            </dl>
          </Item>

          <Item title="Timeline">
            <div className="flex flex-col gap-3 border-l-2 border-[var(--border-default)] pl-4">
              {['Lead criado', 'Contato realizado', 'Proposta enviada'].map((event, i) => (
                <div key={event} className="relative">
                  <span className="absolute -left-[1.35rem] top-1 h-2.5 w-2.5 rounded-full bg-[var(--brand-primary)]" />
                  <p className="text-sm font-medium text-[var(--text-primary)]">{event}</p>
                  <p className="text-xs text-[var(--text-muted)]">{i === 0 ? '12 ago' : i === 1 ? '13 ago' : '15 ago'}</p>
                </div>
              ))}
            </div>
          </Item>

          <Item title="Tree View">
            <div className="text-sm text-[var(--text-primary)]">
              <button onClick={() => setSelectedTreeOpen((v) => !v)} className="flex items-center gap-1.5">
                <ChevronRight className={['h-3.5 w-3.5 transition-transform', selectedTreeOpen ? 'rotate-90' : ''].join(' ')} />
                <Folder className="h-3.5 w-3.5" />
                Contratos
              </button>
              {selectedTreeOpen && (
                <div className="ml-5 mt-1 flex flex-col gap-1 text-[var(--text-secondary)]">
                  <span>KF-2026-0114</span>
                  <span>KF-2026-0115</span>
                </div>
              )}
            </div>
          </Item>

          <Item title="Calendar">
            <div className="grid grid-cols-7 gap-1 text-center text-xs">
              {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => (
                <span key={i} className="text-[var(--text-muted)]">{d}</span>
              ))}
              {Array.from({ length: 30 }, (_, i) => i + 1).map((day) => (
                <span
                  key={day}
                  className={[
                    'flex h-6 w-6 items-center justify-center rounded-full',
                    day === 18 ? 'bg-[var(--text-primary)] text-[var(--text-inverse)]' : 'text-[var(--text-secondary)]',
                  ].join(' ')}
                >
                  {day}
                </span>
              ))}
            </div>
          </Item>

          <Item title="Stat / KPI / Metric Card" span="md">
            <KpiCard
              padding="sm"
              title="Leads em negociação"
              subtitle="Base de leads"
              value="23 / 58"
              trend={<span className="inline-flex items-center gap-1.5 text-xs text-[var(--text-muted)]"><Users className="h-3.5 w-3.5 text-[var(--brand-primary)]" />Pipeline ativo</span>}
            />
          </Item>
        </Cat>

        {/* ═══════════════════ MEDIA ═══════════════════ */}
        <Cat id="media" title="Media" description="Avatares, imagens e mídia.">
          <Item title="Avatar">
            <div className="flex items-center gap-2">
              <Avatar name="Ana Paula Costa" size="sm" />
              <Avatar name="Luiza Ramos" size="md" />
              <Avatar name="Carlos Silva" size="lg" />
            </div>
          </Item>

          <Item title="Avatar Group">
            <AvatarGroup max={3}>
              <Avatar name="Ana Paula" />
              <Avatar name="Carlos Silva" />
              <Avatar name="Fernanda Oliveira" />
              <Avatar name="Roberto Almeida" />
            </AvatarGroup>
          </Item>

          <Item title="Avatar Badge">
            <div className="relative inline-block">
              <Avatar name="Luiza Ramos" size="lg" />
              <AvatarBadge>
                <span className="block h-3 w-3 rounded-full bg-[#3ca65b] ring-2 ring-[var(--bg-surface)]" />
              </AvatarBadge>
            </div>
          </Item>

          <Item title="Image / Thumbnail">
            <div className="flex gap-2">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--bg-hover)]">
                <ImageIcon className="h-5 w-5 text-[var(--text-muted)]" />
              </div>
              <div className="flex h-16 w-24 items-center justify-center rounded-2xl bg-[var(--bg-hover)]">
                <ImageIcon className="h-5 w-5 text-[var(--text-muted)]" />
              </div>
            </div>
          </Item>

          <Item title="Image Gallery" span="md">
            <div className="grid grid-cols-4 gap-2">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="flex aspect-square items-center justify-center rounded-xl bg-[var(--bg-hover)]">
                  <ImageIcon className="h-4 w-4 text-[var(--text-muted)]" />
                </div>
              ))}
            </div>
          </Item>

          <Item title="Carousel / Image Carousel" span="md">
            <div className="flex items-center gap-2">
              <button className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--bg-hover)]">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <div className="flex flex-1 items-center justify-center rounded-xl bg-[var(--bg-hover)] py-6">
                <ImageIcon className="h-5 w-5 text-[var(--text-muted)]" />
              </div>
              <button className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--bg-hover)]">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            <div className="flex justify-center gap-1">
              {[0, 1, 2].map((i) => (
                <span key={i} className={['h-1.5 w-1.5 rounded-full', i === 0 ? 'bg-[var(--text-primary)]' : 'bg-[var(--border-strong)]'].join(' ')} />
              ))}
            </div>
          </Item>

          <Item title="Lightbox">
            <div className="relative flex h-24 items-center justify-center rounded-2xl bg-black/80">
              <ImageIcon className="h-5 w-5 text-white/70" />
              <button className="absolute right-2 top-2 text-white/70">
                <X className="h-4 w-4" />
              </button>
            </div>
          </Item>

          <Item title="Video Player">
            <div className="relative flex h-24 items-center justify-center rounded-2xl bg-[var(--bg-hover)]">
              <button className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--text-primary)] text-[var(--text-inverse)]">
                <Play className="h-4 w-4" />
              </button>
            </div>
          </Item>

          <Item title="Audio Player">
            <div className="flex items-center gap-3 rounded-2xl bg-[var(--bg-hover)] px-3 py-2.5">
              <button className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--text-primary)] text-[var(--text-inverse)]">
                <Pause className="h-3.5 w-3.5" />
              </button>
              <div className="flex flex-1 items-center gap-0.5">
                {Array.from({ length: 20 }, (_, i) => (
                  <span key={i} className="w-0.5 rounded-full bg-[var(--border-strong)]" style={{ height: `${8 + (i % 5) * 4}px` }} />
                ))}
              </div>
              <Music className="h-4 w-4 shrink-0 text-[var(--text-muted)]" />
            </div>
          </Item>
        </Cat>

        {/* ═══════════════════ SEARCH & FILTERS ═══════════════════ */}
        <Cat id="search" title="Search & Filters" description="Localização e refinamento de dados.">
          <Item title="Search / Search Bar" span="md">
            <SearchInput placeholder="Buscar leads, contratos, operadoras..." />
          </Item>

          <Item title="Filter">
            <button className="flex items-center gap-2 rounded-full bg-[var(--bg-hover)] px-4 py-2 text-sm font-medium text-[var(--text-secondary)]">
              <Filter className="h-3.5 w-3.5" />
              Operadora
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
          </Item>

          <Item title="Filter Bar" span="lg">
            <div className="flex flex-wrap items-center gap-2">
              <SearchInput placeholder="Buscar" className="max-w-[14rem]" />
              <button className="flex items-center gap-1 rounded-full bg-[var(--bg-hover)] px-3.5 py-2 text-sm text-[var(--text-secondary)]">
                Status
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
              <button className="flex items-center gap-1 rounded-full bg-[var(--bg-hover)] px-3.5 py-2 text-sm text-[var(--text-secondary)]">
                Operadora
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
              <button className="ml-auto flex items-center gap-1 text-sm font-medium text-[var(--text-secondary)]">
                <SlidersIcon className="h-3.5 w-3.5" />
                Ordenar
              </button>
            </div>
          </Item>

          <Item title="Filter Chips">
            <div className="flex flex-wrap gap-2">
              <span className="flex items-center gap-1.5 rounded-full bg-[var(--brand-primary)] px-3 py-1.5 text-xs font-semibold text-white">
                Novo
                <X className="h-3 w-3" />
              </span>
              <span className="flex items-center gap-1.5 rounded-full bg-[var(--bg-hover)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)]">
                Instagram
                <X className="h-3 w-3" />
              </span>
            </div>
          </Item>

          <Item title="Sort">
            <button className="flex items-center gap-2 rounded-full bg-[var(--bg-hover)] px-4 py-2 text-sm text-[var(--text-secondary)]">
              <SlidersIcon className="h-3.5 w-3.5" />
              Mais recentes
            </button>
          </Item>
        </Cat>

        {/* ═══════════════════ ADVANCED ═══════════════════ */}
        <Cat id="advanced" title="Advanced" description="Padrões de interação avançados.">
          <Item title="Drag & Drop / Sortable List">
            <div className="flex flex-col gap-1.5">
              {['Novo', 'Contato Inicial', 'Proposta Enviada'].map((s) => (
                <div key={s} className="flex items-center gap-2 rounded-xl bg-[var(--bg-hover)] px-3 py-2 text-sm text-[var(--text-primary)]">
                  <GripVertical className="h-4 w-4 text-[var(--text-muted)]" />
                  {s}
                </div>
              ))}
            </div>
          </Item>

          <Item title="Resizable Panel / Split Pane">
            <div className="flex h-20 overflow-hidden rounded-2xl border border-[var(--border-default)]">
              <div className="flex-1 bg-[var(--bg-hover)]" />
              <div className="w-1.5 cursor-col-resize bg-[var(--border-strong)]" />
              <div className="flex-[2] bg-[var(--bg-surface)]" />
            </div>
          </Item>

          <Item title="Infinite Scroll">
            <div className="relative h-24 overflow-hidden rounded-2xl border border-[var(--border-default)] p-2">
              {['Ana Paula', 'Carlos Silva', 'Fernanda'].map((n) => (
                <p key={n} className="py-1 text-sm text-[var(--text-secondary)]">{n}</p>
              ))}
              <div className="absolute inset-x-0 bottom-0 flex h-8 items-end justify-center bg-gradient-to-t from-[var(--bg-surface)] to-transparent pb-1">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--text-muted)]" />
              </div>
            </div>
          </Item>

          <Item title="Tour / Onboarding">
            <div className="relative rounded-2xl bg-[var(--text-primary)] px-4 py-3 text-[var(--text-inverse)]">
              <p className="text-sm font-medium">Novo: filtros por operadora</p>
              <p className="mt-0.5 text-xs opacity-80">Clique aqui para refinar sua busca.</p>
              <span className="absolute -bottom-1.5 left-6 h-3 w-3 rotate-45 bg-[var(--text-primary)]" />
            </div>
          </Item>

          <Item title="Wizard / Multi-step Form" span="md">
            <Stepper currentStep={0} orientation="vertical" steps={[{ label: 'Dados pessoais', description: 'Nome, telefone, e-mail' }, { label: 'Operadora', description: 'Escolha do plano' }, { label: 'Confirmação' }]} />
          </Item>

          <Item title="Rich Text Editor" span="md">
            <div className="rounded-2xl border border-[var(--border-strong)] bg-[var(--bg-surface)]">
              <div className="flex items-center gap-1 border-b border-[var(--border-subtle)] px-2 py-1.5">
                <Bold className="h-3.5 w-3.5 text-[var(--text-secondary)]" />
                <Italic className="h-3.5 w-3.5 text-[var(--text-secondary)]" />
                <Underline className="h-3.5 w-3.5 text-[var(--text-secondary)]" />
                <ListOrdered className="ml-2 h-3.5 w-3.5 text-[var(--text-secondary)]" />
                <List className="h-3.5 w-3.5 text-[var(--text-secondary)]" />
              </div>
              <p className="px-3 py-2.5 text-sm text-[var(--text-secondary)]">Anotações sobre o atendimento...</p>
            </div>
          </Item>

          <Item title="Code Block / Copy Button">
            <div className="relative rounded-2xl bg-[#16110c] p-3 font-mono text-xs text-[#f5f0e6]">
              <button className="absolute right-2 top-2 text-[#a99d89]">
                <Copy className="h-3.5 w-3.5" />
              </button>
              <pre>{`const lead = { nome: 'Ana Paula' };`}</pre>
            </div>
          </Item>

          <Item title="File Manager">
            <div className="flex flex-col gap-1">
              {[{ n: 'contrato.pdf', s: '240 KB' }, { n: 'rg-titular.jpg', s: '1.1 MB' }].map((f) => (
                <div key={f.n} className="flex items-center justify-between rounded-xl px-2 py-1.5 hover:bg-[var(--bg-hover)]">
                  <span className="flex items-center gap-2 text-sm text-[var(--text-primary)]">
                    <FileText className="h-4 w-4 text-[var(--text-muted)]" />
                    {f.n}
                  </span>
                  <span className="text-xs text-[var(--text-muted)]">{f.s}</span>
                </div>
              ))}
            </div>
          </Item>

          <Item title="Kanban Board" span="full">
            <div className="grid grid-cols-3 gap-3">
              {[
                { title: 'Novo', items: ['Ana Paula Costa', 'Roberto Almeida'] },
                { title: 'Proposta Enviada', items: ['Carlos Eduardo'] },
                { title: 'Convertido', items: ['Fernanda Oliveira'] },
              ].map((col) => (
                <div key={col.title} className="rounded-2xl bg-[var(--bg-hover)] p-2.5">
                  <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">{col.title}</p>
                  <div className="flex flex-col gap-2">
                    {col.items.map((item) => (
                      <div key={item} className="rounded-xl bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] shadow-[var(--shadow-card)]">
                        {item}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Item>
        </Cat>

        {/* ═══════════════════ LAYOUT / UTILITY ═══════════════════ */}
        <Cat id="layout" title="Layout / Utility" description="Blocos estruturais e utilitários de composição.">
          <Item title="Container">
            <div className="mx-auto max-w-[12rem] rounded-xl bg-[var(--bg-hover)] px-3 py-2 text-center text-xs text-[var(--text-muted)]">
              max-width container
            </div>
          </Item>

          <Item title="Stack">
            <div className="flex flex-col gap-1.5">
              <div className="h-6 rounded-lg bg-[var(--bg-hover)]" />
              <div className="h-6 rounded-lg bg-[var(--bg-hover)]" />
              <div className="h-6 rounded-lg bg-[var(--bg-hover)]" />
            </div>
          </Item>

          <Item title="Grid">
            <div className="grid grid-cols-4 gap-1.5">
              {Array.from({ length: 8 }, (_, i) => (
                <div key={i} className="flex h-8 items-center justify-center rounded-lg bg-[var(--bg-hover)] text-[10px] text-[var(--text-muted)]">
                  {i + 1}
                </div>
              ))}
            </div>
          </Item>

          <Item title="Divider / Separator">
            <div className="flex flex-col gap-3">
              <p className="text-xs text-[var(--text-muted)]">Acima</p>
              <hr className="border-[var(--border-default)]" />
              <p className="text-xs text-[var(--text-muted)]">Abaixo</p>
            </div>
          </Item>

          <Item title="Spacer">
            <div className="flex items-center text-xs text-[var(--text-muted)]">
              <span>A</span>
              <span className="mx-3 h-px flex-1 border-t border-dashed border-[var(--border-strong)]" />
              <span>B</span>
            </div>
          </Item>

          <Item title="Aspect Ratio">
            <div className="w-full overflow-hidden rounded-xl bg-[var(--bg-hover)]" style={{ aspectRatio: '16 / 9' }}>
              <div className="flex h-full items-center justify-center text-xs text-[var(--text-muted)]">16:9</div>
            </div>
          </Item>

          <Item title="Scroll Area">
            <div className="h-20 overflow-y-auto rounded-xl border border-[var(--border-default)] p-2 text-sm text-[var(--text-secondary)]">
              <p className="pb-2">Linha 1 de conteúdo rolável</p>
              <p className="pb-2">Linha 2 de conteúdo rolável</p>
              <p className="pb-2">Linha 3 de conteúdo rolável</p>
              <p className="pb-2">Linha 4 de conteúdo rolável</p>
            </div>
          </Item>

          <Item title="Portal">
            <p className="text-sm text-[var(--text-secondary)]">
              Renderiza fora da árvore local (usado por Dialog, Drawer e Toast neste sistema).
            </p>
          </Item>

          <Item title="Visually Hidden">
            <p className="text-sm text-[var(--text-secondary)]">
              Conteúdo acessível a leitores de tela, oculto visualmente — usado em labels de ícones e campos.
            </p>
          </Item>
        </Cat>

        <div className="mt-4 flex justify-center">
          <button className="rounded-full bg-[var(--bg-hover)] px-6 py-3 text-sm font-medium text-[var(--text-secondary)] transition hover:bg-[var(--bg-active)]">
            And more...
          </button>
        </div>
      </div>
    </div>
  );
}

export default function DesignSystemShowcase() {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === 'undefined') return 'light';
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return stored === 'dark' ? 'dark' : 'light';
  });

  useEffect(() => {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  return (
    <div className={`painel-theme kifer-ds theme-${theme}`}>
      <ToastProvider position="bottom-right">
        <ThemeToggle theme={theme} onChange={setTheme} />
        <ShowcaseContent />
      </ToastProvider>
    </div>
  );
}
