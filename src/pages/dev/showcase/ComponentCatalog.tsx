import { FieldLabel } from '../../../design-system';
import { useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  HelpCircle,
  FileText,
  Filter,
  LayoutDashboard,
  LayoutGrid,
  List,
  Mail,
  MoreHorizontal,
  Pencil,
  Plus,
  Save,
  Settings,
  Trash2,
  Users,
} from 'lucide-react';
import {
  ActionSurface,
  ActivityCard,
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
  CardIcon,
  ChartCard,
  Checkbox,
  ClienteCard,
  Combobox,
  ConfirmDialog,
  ControlGroup,
  DateRangeFilter,
  DateTimePicker,
  Dialog,
  DialogBody,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DisclosureTrigger,
  DesignSystemProvider,
  Drawer,
  DrawerBody,
  DrawerFooter,
  DrawerHeader,
  ExternalLink,
  Field,
  FilterBar,
  FilterMultiSelect,
  FilterSelect,
  FormActions,
  PageActions,
  Heading,
  IconButton,
  Inline,
  Input,
  InputAddon,
  InputGroup,
  KpiCard,
  LeadCard,
  LinkButton,
  LoadingState,
  MultiSelect,
  NavigationList,
  OperationalMetricChip,
  OperationalStatusBadge,
  OperationalStatusDot,
  OpportunityCard,
  Pagination,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Progress,
  PublicCard,
  PublicEmptyState,
  PublicSection,
  PublicShell,
  Radio,
  RadioGroup,
  SearchInput,
  SectionHeader,
  SegmentedControl,
  Select,
  Skeleton,
  Stack,
  Stepper,
  SummaryCard,
  Surface,
  Switch,
  Tabs,
  TaskCard,
  Text,
  Textarea,
  TextLink,
  Toast,
  Tooltip,
  Toolbar,
  ToolbarActions,
  ToolbarSearch,
  WorkspaceDialog,
  WorkspaceHeader,
  BrandWordmark,
  useToast,
  type ButtonVariant,
  type CardKind,
  type SurfaceVariant,
} from '../../../design-system';
import { componentGroups, type ComponentGroup } from './catalog';
import { ContactForm, ContactList } from './WorkspacePreview';
import { demoContacts, operatorOptions, statusOptions } from './demoData';
import { SectionIntro, Specimen, UsageNote } from './ShowcaseParts';
import ApplicationComponents from './ApplicationComponents';

export default function ComponentCatalog() {
  const [group, setGroup] = useState<ComponentGroup>('actions');
  return (
    <>
      <SectionIntro
        number="02"
        title="Componentes reais. Possibilidades consistentes."
      >
        Blocos que já fazem parte do projeto, organizados por função. Interaja
        com os exemplos e consulte a origem de cada componente.
      </SectionIntro>
      <div className="ds-catalog-tabs">
        <Tabs
          ariaLabel="Categorias de componentes"
          items={componentGroups}
          value={group}
          onChange={setGroup}
        />
      </div>
      {group === 'actions' && <Actions />}
      {group === 'forms' && <Forms />}
      {group === 'navigation' && <Navigation />}
      {group === 'data' && <Data />}
      {group === 'feedback' && <Feedback />}
      {group === 'overlays' && <Overlays />}
      {group === 'application' && <ApplicationComponents />}
    </>
  );
}

function Actions() {
  const [controlDate, setControlDate] = useState('2026-10-26');
  const [actionExamples, setActionExamples] = useState(1);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const { toast } = useToast();
  const [period, setPeriod] = useState('week');
  const [view, setView] = useState('list');
  const [selected, setSelected] = useState(false);
  const variants: Array<[ButtonVariant, string]> = [
    ['primary', 'Primário'],
    ['secondary', 'Secundário'],
    ['tertiary', 'Terciário'],
    ['ghost', 'Discreto'],
    ['text', 'Texto'],
    ['soft', 'Suave'],
    ['destructive', 'Destrutivo'],
    ['danger', 'Erro'],
    ['success', 'Sucesso'],
    ['warning', 'Atenção'],
    ['info', 'Informação'],
    ['gold', 'Destaque'],
  ];
  return (
    <>
      <UsageNote>
        Uma ação primária por contexto. Use verbos claros: criar contato, salvar
        alterações, aplicar filtros. Ações destrutivas ficam separadas e
        explicam o impacto antes de executar.
      </UsageNote>
      <div className="ds-grid">
        <Specimen
          title="Hierarquia de ações"
          description="Todas as variantes públicas compartilham geometria, foco e estados."
          source="Button / LoadingButton · components/Button.tsx"
          wide
        >
          <div className="ds-row">
            {variants.map(([variant, label]) => (
              <Button
                key={variant}
                variant={variant}
                onClick={() =>
                  toast({
                    variant: 'info',
                    description: `Você acionou o exemplo de botão “${label}”.`,
                  })
                }
              >
                {label}
              </Button>
            ))}
          </div>
        </Specimen>
        <Specimen
          title="Escala de tamanho"
          description="Desktop: 32, 40 e 48 px. Em telas pequenas, alvos com no mínimo 44 px."
          source="Button size=sm | md | lg · --control-height-*"
        >
          <div className="ds-row">
            {(['sm', 'md', 'lg'] as const).map((size) => (
              <Button
                key={size}
                size={size}
                onClick={() =>
                  toast({
                    description: `Exemplo de tamanho ${size}.`,
                    variant: 'info',
                  })
                }
              >
                <Plus />
                Criar contato
              </Button>
            ))}
          </div>
          <Button
            fullWidth
            variant="secondary"
            onClick={() =>
              toast({
                description: 'Exemplo de ação em largura total.',
                variant: 'info',
              })
            }
          >
            Largura total
          </Button>
        </Specimen>
        <Specimen
          title="Controles alinhados na mesma barra"
          description="Use md (40 px) em cabeçalhos, filtros e ações de formulários. Use sm (32 px) apenas em grupos compactos. No mobile, ambos têm no mínimo 44 px. O grupo determina a altura, os ícones e a tipografia dos controles; rótulos longos podem quebrar linha."
          source="ControlGroup / Toolbar size / PageHeader / PageActions"
          wide
        >
          {(['sm', 'md'] as const).map((size) => (
            <ControlGroup key={size} size={size} className="ds-row" aria-label={`Controles ${size}`}>
              <IconButton variant="secondary" aria-label={`Dia anterior ${size}`} onClick={() => {
                const date = new Date(`${controlDate || '2026-10-26'}T12:00:00`);
                date.setDate(date.getDate() - 1);
                setControlDate(date.toISOString().slice(0, 10));
              }}><ArrowLeft /></IconButton>
              <div className="w-44 max-w-full"><DateTimePicker type="date" value={controlDate} aria-label={`Data ${size}`} onChange={(event) => setControlDate(event.target.value)} /></div>
              <Button variant="secondary" onClick={() => setControlDate('2026-10-26')}>Hoje</Button>
              <Button onClick={() => toast({ variant: 'info', description: 'Exemplo de criação de tarefa.' })}><Plus />Nova tarefa</Button>
            </ControlGroup>
          ))}
        </Specimen>
        <Specimen
          title="Ícones e ações compactas"
          description="Rótulos acessíveis para ações sem texto. Tooltip reforça o significado."
          source="IconButton / Tooltip / Button"
        >
          <div className="ds-row">
            <Button
              onClick={() =>
                toast({
                  description: 'Exemplo salvo nesta sessão.',
                  variant: 'success',
                })
              }
            >
              <Save />
              Salvar exemplo
            </Button>
            <Button
              variant="secondary"
              onClick={() =>
                toast({
                  description: 'Voltando ao contexto de exemplo.',
                  variant: 'info',
                })
              }
            >
              <ArrowLeft />
              Voltar
            </Button>
            {[
              { icon: Pencil, label: 'Editar exemplo' },
              { icon: Trash2, label: 'Excluir exemplo' },
              { icon: MoreHorizontal, label: 'Mais ações' },
            ].map(({ icon: Icon, label }) => (
              <Tooltip key={label} content={label}>
                <IconButton
                  aria-label={label}
                  onClick={() => toast({ description: label, variant: 'info' })}
                >
                  <Icon />
                </IconButton>
              </Tooltip>
            ))}
          </div>
        </Specimen>
        <Specimen
          title="Grupos e alternância"
          description="Agrupe opções relacionadas. A seleção fica evidente além da cor."
          source="ButtonGroup / SegmentedControl"
        >
          <ButtonGroup size="sm">
            {[
              { id: 'day', label: 'Dia' },
              { id: 'week', label: 'Semana' },
              { id: 'month', label: 'Mês' },
            ].map((item) => (
              <Button
                key={item.id}
                variant={period === item.id ? 'soft' : 'ghost'}
                size="sm"
                aria-pressed={period === item.id}
                onClick={() => setPeriod(item.id)}
              >
                {item.label}
              </Button>
            ))}
          </ButtonGroup>
          <SegmentedControl
            ariaLabel="Modo de exibição"
            items={[
              { id: 'list', label: 'Lista', icon: List },
              { id: 'grid', label: 'Cards', icon: LayoutGrid },
            ]}
            value={view}
            onChange={setView}
          />
          <Text size="sm">
            Exibição selecionada: {view === 'list' ? 'lista' : 'cards'}.
          </Text>
        </Specimen>
        <Specimen
          title="Ações de registros"
          description="Use ButtonGroup para ações relacionadas do mesmo registro. O contorno acompanha o conteúdo, mesmo em colunas largas. Mantenha abrir/editar antes de excluir. Use orientação vertical somente para ordenação."
          source="ButtonGroup size / orientation / IconButton"
        >
          <div className="grid grid-cols-1 gap-3">
            <ButtonGroup aria-label="Ações do registro demonstrativo">
              <IconButton variant="secondary" aria-label="Editar registro demonstrativo" onClick={() => toast({ variant: 'info', description: 'Edição demonstrativa selecionada.' })}><Pencil /></IconButton>
              <IconButton variant="danger" aria-label="Excluir registro demonstrativo" onClick={() => setDeleteConfirm(true)}><Trash2 /></IconButton>
            </ButtonGroup>
            <ButtonGroup size="sm" orientation="vertical" aria-label="Ordenar registro demonstrativo">
              <IconButton variant="ghost" aria-label="Mover registro para cima" onClick={() => toast({ variant: 'info', description: 'Movimento demonstrativo para cima.' })}><ArrowLeft className="rotate-90" /></IconButton>
              <IconButton variant="ghost" aria-label="Mover registro para baixo" onClick={() => toast({ variant: 'info', description: 'Movimento demonstrativo para baixo.' })}><ArrowRight className="rotate-90" /></IconButton>
            </ButtonGroup>
          </div>
        </Specimen>
        <Specimen
          title="Links e superfícies interativas"
          description="Links navegam; botões executam ações. Superfícies selecionáveis usam estado explícito."
          source="TextLink / ExternalLink / LinkButton / ActionSurface"
        >
          <div className="ds-row">
            <TextLink href="#foundations">Ver fundamentos</TextLink>
            <LinkButton
              href="/design-system#patterns"
              variant="secondary"
              size="sm"
            >
              Ver padrões
              <ArrowRight />
            </LinkButton>
          </div>
          <ActionSurface
            selected={selected}
            aria-pressed={selected}
            onClick={() => setSelected(!selected)}
          >
            <div className="ds-between">
              <span>Plano empresarial</span>
              {selected ? <Check size={18} /> : <Plus size={18} />}
            </div>
            <Text size="sm">
              {selected
                ? 'Selecionado para o exemplo'
                : 'Clique para selecionar'}
            </Text>
          </ActionSurface>
          <details className="ds-source">
            <summary>Referência externa</summary>
            <ExternalLink href="https://lucide.dev/icons/">
              Biblioteca oficial de ícones
            </ExternalLink>
          </details>
        </Specimen>
        <Specimen
          title="Ações da página"
          description="Uma ordem oficial: exclusão isolada, secundárias antes da principal. A exclusão exige confirmação."
          source="PageActions / ConfirmDialog"
          wide
        >
          <div role="status">
            <Badge tone="info">{actionExamples} exemplos neste bloco</Badge>
          </div>
          <PageActions
            destructive={{
              label: 'Excluir exemplo',
              icon: Trash2,
              disabled: actionExamples === 0,
              onClick: () => setDeleteConfirm(true),
            }}
            secondary={[
              { label: 'Reiniciar', onClick: () => setActionExamples(1) },
            ]}
            primary={{
              label: 'Adicionar exemplo',
              icon: Plus,
              onClick: () => setActionExamples((current) => current + 1),
            }}
          />
          <ConfirmDialog
            open={deleteConfirm}
            onOpenChange={setDeleteConfirm}
            title="Excluir um exemplo?"
            description="A contagem deste bloco será reduzida em um. Use Reiniciar para restaurar a demonstração."
            confirmLabel="Excluir exemplo"
            destructive
            closeOnConfirm
            onConfirm={() =>
              setActionExamples((current) => Math.max(0, current - 1))
            }
          />
        </Specimen>
        <Specimen
          title="Salvar e cancelar"
          description="Cancelar antes de Salvar. A mensagem de contexto fica próxima das ações."
          source="FormActions · components/FormActions.tsx"
          wide
        >
          <form
            onSubmit={(event) => {
              event.preventDefault();
              toast({
                variant: 'success',
                description: 'Ação de salvar executada no exemplo local.',
              });
            }}
          >
            <FormActions
              onCancel={() =>
                toast({
                  variant: 'info',
                  description: 'Edição do exemplo cancelada.',
                })
              }
              message="As ações se alinham ao final do formulário."
            />
          </form>
        </Specimen>
      </div>
    </>
  );
}

function Forms() {
  const [phone, setPhone] = useState('');
  const [cpf, setCpf] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [money, setMoney] = useState('');
  const [cep, setCep] = useState('');
  const [cns, setCns] = useState('');
  const [operator, setOperator] = useState('Amil');
  const [multi, setMulti] = useState(['Amil']);
  const [search, setSearch] = useState('');
  const [checked, setChecked] = useState(true);
  const [mixed, setMixed] = useState(true);
  const [radio, setRadio] = useState('person');
  const [enabled, setEnabled] = useState(true);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [datetime, setDatetime] = useState('');
  const { toast } = useToast();
  return (
    <>
      <UsageNote>
        Rótulos sempre acima dos campos. Ajuda explica o formato antes do erro;
        validação aparece junto ao campo. Campos obrigatórios são identificados,
        e placeholders apenas mostram exemplos.
      </UsageNote>
      <div className="ds-grid">
        <Specimen
          title="Campos de texto"
          description="As três alturas canônicas, com e sem ícone e descrição."
          source="Input / SearchInput / Field"
        >
          <Field label="Nome do contato">
            <Input placeholder="Ex.: Ana Paula Ribeiro" size="sm" />
          </Field>
          <Field label="E-mail">
            <Input
              type="email"
              placeholder="nome@exemplo.com"
              leftIcon={Mail}
            />
          </Field>
          <Field label="Busca em destaque">
            <SearchInput
              size="lg"
              placeholder="Buscar contatos"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </Field>
          {search && <Text size="sm">Busca digitada: {search}</Text>}
        </Specimen>
        <Specimen
          title="Complementos e texto longo"
          description="Unidade, prefixo e contexto fazem parte do campo."
          source="InputGroup / InputAddon / Textarea"
        >
          <div className="kds-field">
            <FieldLabel
              className="kds-field-label"
              htmlFor="ds-showcase-monthly-amount"
            >
              Valor mensal
            </FieldLabel>
            <InputGroup>
              <InputAddon>R$</InputAddon>
              <Input
                id="ds-showcase-monthly-amount"
                autoFormat="currency"
                inputMode="decimal"
                value={money}
                onChange={(event) => setMoney(event.target.value)}
                placeholder="0,00"
              />
            </InputGroup>
          </div>
          <Field
            label="Observações"
            hint="Registre informações úteis para o próximo atendimento."
          >
            <Textarea
              rows={3}
              placeholder="Preferências do contato e próximos passos"
            />
          </Field>
        </Specimen>
        <Specimen
          title="Máscaras brasileiras"
          description="As mesmas funções de formatação que o CRM utiliza."
          source="Input autoFormat · src/lib/inputFormatters.ts"
          wide
        >
          <div className="ds-form-grid">
            {[
              {
                label: 'Telefone',
                format: 'phone',
                value: phone,
                change: setPhone,
                placeholder: '(11) 99999-0000',
              },
              {
                label: 'CPF',
                format: 'cpf',
                value: cpf,
                change: setCpf,
                placeholder: '000.000.000-00',
              },
              {
                label: 'CNPJ',
                format: 'cnpj',
                value: cnpj,
                change: setCnpj,
                placeholder: '00.000.000/0000-00',
              },
              {
                label: 'CEP',
                format: 'cep',
                value: cep,
                change: setCep,
                placeholder: '00000-000',
              },
              {
                label: 'Cartão nacional de saúde',
                format: 'cns',
                value: cns,
                change: setCns,
                placeholder: '000 0000 0000 0000',
              },
            ].map((item) => (
              <Field key={item.format} label={item.label}>
                <Input
                  autoFormat={
                    item.format as 'phone' | 'cpf' | 'cnpj' | 'cep' | 'cns'
                  }
                  inputMode="numeric"
                  placeholder={item.placeholder}
                  value={item.value}
                  onChange={(event) => item.change(event.target.value)}
                />
              </Field>
            ))}
          </div>
          <Text size="sm">
            A máscara orienta a digitação. A validação de documentos pertence ao
            fluxo de cadastro.
          </Text>
        </Specimen>
        <Specimen
          title="Seleção simples e múltipla"
          description="Select para opções curtas; combobox quando a busca facilita a escolha."
          source="Select / Combobox / MultiSelect"
        >
          {(['sm', 'md', 'lg'] as const).map((size) => (
            <Field label={`Operadora · ${size}`} key={size}>
              <Select
                size={size}
                value={operator}
                onChange={(event) => setOperator(event.target.value)}
                options={operatorOptions}
              />
            </Field>
          ))}
          <Field label="Buscar operadora">
            <Combobox
              value={operator}
              onChange={setOperator}
              options={operatorOptions}
              searchPlaceholder="Buscar operadora…"
              aria-label="Buscar operadora"
            />
          </Field>
          <Field label="Operadoras de interesse">
            <MultiSelect
              values={multi}
              onChange={setMulti}
              options={operatorOptions}
              aria-label="Operadoras de interesse"
            />
          </Field>
        </Specimen>
        <Specimen
          title="Escolhas e preferências"
          description="Checkbox para múltiplas escolhas, radio para uma escolha e switch para ativação."
          source="Checkbox / RadioGroup / Radio / Switch"
        >
          <FieldLabel className="ds-choice">
            <Checkbox
              checked={checked}
              onChange={(event) => setChecked(event.target.checked)}
            />
            Receber resumo do atendimento
          </FieldLabel>
          <FieldLabel className="ds-choice">
            <Checkbox
              ref={(element) => {
                if (element) element.indeterminate = mixed;
              }}
              aria-checked={mixed ? 'mixed' : checked}
              checked={!mixed && checked}
              onChange={() => {
                setMixed(false);
                setChecked(true);
              }}
            />
            Seleção parcial — clique para selecionar
          </FieldLabel>
          <FieldLabel className="ds-choice">
            <Checkbox disabled />
            Opção indisponível
          </FieldLabel>
          <fieldset>
            <legend className="ds-caption">Tipo de contratação</legend>
            <RadioGroup
              name="showcase-contract-type"
              value={radio}
              onValueChange={setRadio}
            >
              <Radio
                value="person"
                label="Pessoa física"
                description="Contratação individual ou familiar"
              />
              <Radio
                value="company"
                label="Empresa"
                description="Contratação empresarial"
              />
              <Radio value="unavailable" label="Opção indisponível" disabled />
            </RadioGroup>
          </fieldset>
          <Switch
            checked={enabled}
            onChange={(event) => setEnabled(event.target.checked)}
            label="Mostrar lembretes no exemplo"
            aria-label="Mostrar lembretes no exemplo"
          />
          <Switch
            disabled
            label="Configuração indisponível"
            aria-label="Configuração indisponível"
          />
        </Specimen>
        <Specimen
          title="Data e horário"
          description="Seleção compacta em etapas: data, hora e minutos. Use os atalhos ou informe o minuto exato; confirme para aplicar."
          source="DateTimePicker type=date | time | datetime-local"
        >
          <Field label="Data">
            <DateTimePicker
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              placeholder="Selecionar uma data"
            />
          </Field>
          <Field label="Horário">
            <DateTimePicker
              type="time"
              value={time}
              onChange={(event) => setTime(event.target.value)}
              placeholder="Selecionar horário"
            />
          </Field>
          <Field label="Atendimento">
            <DateTimePicker
              value={datetime}
              onChange={(event) => setDatetime(event.target.value)}
              placeholder="Selecionar data e horário"
            />
          </Field>
          <Field label="Data indisponível" disabled>
            <DateTimePicker disabled placeholder="Seleção bloqueada" />
          </Field>
        </Specimen>
        <Specimen
          title="Formulário com validação"
          description="Tente salvar sem preencher. Corrija os campos e conclua a ação local."
          source="Field + Input + Select + Textarea + FormActions"
          wide
        >
          <ContactForm
            onCancel={() =>
              toast({
                variant: 'info',
                description:
                  'Exemplo cancelado. Os campos voltaram aos valores iniciais.',
              })
            }
            onSave={(contact) =>
              toast({
                variant: 'success',
                title: 'Exemplo validado',
                description: `${contact.name}: os campos do exemplo foram preenchidos corretamente.`,
              })
            }
          />
        </Specimen>
      </div>
    </>
  );
}

function Navigation() {
  const [workspaceTheme, setWorkspaceTheme] = useState<'light' | 'dark'>('light');
  const [active, setActive] = useState('contacts');
  const [tab, setTab] = useState('summary');
  const [page, setPage] = useState(1);
  const [step, setStep] = useState(0);
  const items = [
    { id: 'summary', label: 'Resumo', icon: LayoutDashboard },
    { id: 'contacts', label: 'Contatos', icon: Users },
    { id: 'settings', label: 'Configurações', icon: Settings },
  ];
  return (
    <>
      <UsageNote>
        Navegação principal conserva a posição. Abas alternam o conteúdo no
        mesmo contexto; breadcrumbs mostram o caminho. A seção atual sempre tem
        indicação visual e acessível.
      </UsageNote>
      <div className="ds-grid">
        <Specimen
          title="Sidebar e navegação"
          description="Links reais com indicação da seção atual. Também usada na navegação deste showcase."
          source="NavigationList · components/NavigationList.tsx"
        >
          <BrandWordmark caption="CRM" /><DesignSystemProvider theme={workspaceTheme}><WorkspaceHeader title="Gestão de leads" username="Operador Demonstração" theme={workspaceTheme} onNavigateHome={() => setActive('summary')} onToggleTheme={() => setWorkspaceTheme(theme => theme === 'light' ? 'dark' : 'light')} /></DesignSystemProvider>
          <NavigationList
            items={items.map((item) => ({
              ...item,
              href: `#example-${item.id}`,
            }))}
            activeId={active}
            onNavigate={setActive}
            ariaLabel="Navegação demonstrativa"
          />
          <Surface variant="muted" padding="sm">
            <Text size="sm">
              Seção selecionada:{' '}
              {items.find((item) => item.id === active)?.label}.
            </Text>
          </Surface>
        </Specimen>
        <Specimen
          title="Header e caminho da página"
          description="Identidade à esquerda, ações de contexto à direita e breadcrumb acima do título."
          source="Breadcrumb / BreadcrumbItem / BreadcrumbLink / Avatar / IconButton"
        >
          <Surface>
            <div className="ds-between">
              <strong>Kifer Saúde</strong>
              <div className="ds-row">
                <Tooltip content="Notificações do exemplo">
                  <IconButton
                    aria-label="Notificações do exemplo"
                    onClick={() => setTab('contacts')}
                  >
                    <Bell />
                  </IconButton>
                </Tooltip>
                <Avatar name="Marina Costa" size="sm" />
              </div>
            </div>
          </Surface>
          <Breadcrumb>
            <BreadcrumbItem>
              <BreadcrumbLink href="#overview">CRM</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href="#patterns">Contatos</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>Ana Paula</BreadcrumbItem>
          </Breadcrumb>
          <Text size="sm">
            A indicação do caminho usa nomes familiares, sem códigos internos.
          </Text>
        </Specimen>
        <Specimen
          title="Abas e segmentação"
          description="Setas movem entre abas; Home e End vão ao início e ao fim."
          source="Tabs variant=underline | pill | rail / SegmentedControl"
          wide
        >
          {(['underline', 'pill', 'rail'] as const).map((variant) => (
            <Tabs
              key={variant}
              variant={variant}
              ariaLabel={`Abas em estilo ${variant}`}
              items={[
                ...items,
                { id: 'disabled', label: 'Indisponível', disabled: true },
              ]}
              value={tab}
              onChange={setTab}
            />
          ))}
          <Surface variant="muted" padding="sm">
            <Text>
              Conteúdo da aba: {items.find((item) => item.id === tab)?.label}.
            </Text>
          </Surface>
        </Specimen>
        <Specimen
          title="Paginação"
          description="Quantidade, posição atual e limites claros para listas longas."
          source="Pagination / PaginationInfo"
        >
          <Pagination
            currentPage={page}
            totalPages={8}
            onPageChange={setPage}
            itemsPerPage={10}
            totalItems={78}
          />
          <Text size="sm">Página {page} de 8.</Text>
        </Specimen>
        <Specimen
          title="Etapas de um processo"
          description="Orienta o progresso de formulários maiores sem esconder o próximo passo."
          source="Stepper / Progress"
        >
          <Stepper
            steps={[
              { label: 'Contato' },
              { label: 'Plano' },
              { label: 'Revisão' },
            ]}
            currentStep={step}
          />
          <Progress value={((step + 1) / 3) * 100} showLabel />
          <div className="ds-row">
            <Button
              variant="secondary"
              size="sm"
              disabled={step === 0}
              onClick={() => setStep(step - 1)}
            >
              <ArrowLeft />
              Anterior
            </Button>
            <Button
              size="sm"
              disabled={step === 2}
              onClick={() => setStep(step + 1)}
            >
              Avançar
              <ArrowRight />
            </Button>
          </div>
          <details className="ds-source">
            <summary>Orientação vertical</summary>
            <Stepper
              orientation="vertical"
              steps={[
                { label: 'Contato' },
                { label: 'Plano' },
                { label: 'Revisão' },
              ]}
              currentStep={step}
            />
          </details>
        </Specimen>
      </div>
    </>
  );
}

function Data() {
  const [status, setStatus] = useState('');
  const [owners, setOwners] = useState<string[]>([]);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [cardKind, setCardKind] = useState<CardKind>('lead');
  const [surface, setSurface] = useState<SurfaceVariant>('default');
  const [detail, setDetail] = useState<string | null>(null);
  const kinds: CardKind[] = [
    'base',
    'kpi',
    'customer',
    'client',
    'opportunity',
    'lead',
    'activity',
    'task',
    'summary',
    'chart',
  ];
  return (
    <>
      <UsageNote>
        Busca e filtros precedem os dados. Alinhe valores à direita; preserve
        nomes legíveis e status textuais. Cards agrupam uma responsabilidade,
        indicadores mostram valor e contexto.
      </UsageNote>
      <div className="ds-grid">
        <Specimen
          title="Tabela com comportamento real"
          description="Busque, filtre, ordene, selecione linhas e alterne páginas. Os dados são locais."
          source="Table + SortableTableHead + FilterBar + SearchInput + Pagination"
          wide
        >
          <ContactList onOpen={(contact) => setDetail(contact.name)} />
          <Dialog
            open={detail !== null}
            onOpenChange={(open) => !open && setDetail(null)}
            size="sm"
          >
            <DialogHeader onClose={() => setDetail(null)}>
              <DialogTitle>{detail}</DialogTitle>
              <DialogDescription>
                Contato demonstrativo selecionado na tabela.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button onClick={() => setDetail(null)}>Concluído</Button>
            </DialogFooter>
          </Dialog>
        </Specimen>
        <Specimen
          title="Barra de filtros"
          description="Filtros ativos mostram a seleção. Limpar restaura a visão sem restrições."
          source="Toolbar / ToolbarSearch / ToolbarActions / FilterSelect / FilterMultiSelect / DateRangeFilter / DisclosureTrigger"
          wide
        >
          <Toolbar>
            <ToolbarSearch>
              <SearchInput
                aria-label="Busca demonstrativa de filtros"
                placeholder="Buscar na lista"
              />
            </ToolbarSearch>
            <ToolbarActions>
              <FilterSelect
                icon={Filter}
                placeholder="Status"
                value={status}
                onChange={setStatus}
                options={statusOptions}
              />
              <FilterMultiSelect
                icon={Users}
                placeholder="Operadoras"
                values={owners}
                onChange={setOwners}
                options={operatorOptions}
              />
              <DateRangeFilter
                icon={CalendarDays}
                label="Período"
                fromValue={from}
                toValue={to}
                onFromChange={setFrom}
                onToChange={setTo}
                type="date"
              />
            </ToolbarActions>
          </Toolbar>
          <details>
            <DisclosureTrigger icon={Filter}>Filtros avançados</DisclosureTrigger>
            <Surface padding="sm" className="mt-3">
              <FilterMultiSelect icon={Users} placeholder="Operadoras" values={owners} onChange={setOwners} options={operatorOptions} />
            </Surface>
          </details>
          <FilterBar>
            <Text size="sm">
              {status || 'Todos os status'} ·{' '}
              {owners.length ? owners.join(', ') : 'Todas as operadoras'}
            </Text>
            <Button
              variant="text"
              size="sm"
              onClick={() => {
                setStatus('');
                setOwners([]);
                setFrom('');
                setTo('');
              }}
            >
              Limpar seleção
            </Button>
          </FilterBar>
          <Text size="sm">
            Esta amostra demonstra os controles. A tabela acima aplica busca e
            status sobre os contatos.
          </Text>
        </Specimen>
        <Specimen
          title="Cards e superfícies"
          description="Variantes da biblioteca; a hierarquia de conteúdo permanece constante."
          source="Card / Surface / CardIcon / CrmCard"
        >
          <div className="ds-row">
            {(
              ['default', 'muted', 'glass', 'strong', 'interactive'] as const
            ).map((variant) => (
              <Card key={variant} variant={variant} padding="sm">
                <Text size="sm">{variant}</Text>
              </Card>
            ))}
          </div>
          <Field label="Família de card">
            <Select
              value={cardKind}
              options={kinds.map((value) => ({ value, label: value }))}
              onChange={(event) => setCardKind(event.target.value as CardKind)}
            />
          </Field>
          <Card kind={cardKind}>
            <div className="ds-row">
              <CardIcon>
                <Users size={18} />
              </CardIcon>
              <div>
                <Heading level={3}>Atendimento em andamento</Heading>
                <Text size="sm">
                  Informação principal, contexto e próxima ação.
                </Text>
              </div>
            </div>
          </Card>
          <Field label="Superfície semântica">
            <Select
              value={surface}
              options={[
                'default',
                'muted',
                'strong',
                'hero',
                'danger',
                'warning',
                'success',
                'info',
              ].map((value) => ({ value, label: value }))}
              onChange={(event) =>
                setSurface(event.target.value as SurfaceVariant)
              }
            />
          </Field>
          <Surface variant={surface}>
            <Text>Superfície selecionada: {surface}.</Text>
          </Surface>
        </Specimen>
        <Specimen
          title="Indicadores e status"
          description="Valores com rótulos e contexto; cor nunca é a única informação."
          source="KpiCard / Badge / OperationalMetricChip / OperationalStatusBadge / OperationalStatusDot"
        >
          <KpiCard
            title="Contatos em atendimento"
            value="24"
            subtitle="Base ilustrativa de demonstração"
            trend="8 aguardando retorno"
            icon={<Users />}
          />
          <div className="ds-row">
            {(
              [
                'neutral',
                'accent',
                'gold',
                'success',
                'warning',
                'danger',
                'info',
              ] as const
            ).map((tone) => (
              <OperationalMetricChip
                key={tone}
                value="8"
                label={tone}
                tone={tone}
              />
            ))}
          </div>
          <div className="ds-row">
            <OperationalStatusBadge statusColor="var(--success-text)">
              Atendimento disponível
            </OperationalStatusBadge>
            <OperationalStatusDot statusColor="var(--warning-text)" />
            <Text size="sm">Aguardando retorno</Text>
          </div>
          <div className="ds-row">
            {(['sm', 'md', 'lg'] as const).map((size) => (
              <Badge key={size} size={size} tone="success" icon={CheckCircle2}>
                Contratado
              </Badge>
            ))}
          </div>
          <div className="ds-row">
            {(
              [
                'new-lead',
                'contact',
                'qualified',
                'proposal',
                'negotiation',
                'won',
                'lost',
                'pending',
                'completed',
                'overdue',
                'paid',
                'whatsapp',
                'referral',
              ] as const
            ).map((tone, index) => (
              <Badge key={tone} tone={tone}>
                {
                  [
                    'Novo contato',
                    'Em contato',
                    'Qualificado',
                    'Proposta',
                    'Negociação',
                    'Contratado',
                    'Perdido',
                    'Pendente',
                    'Concluído',
                    'Em atraso',
                    'Pago',
                    'WhatsApp',
                    'Indicação',
                  ][index]
                }
              </Badge>
            ))}
          </div>
        </Specimen>
        <Specimen
          title="Famílias de cards do CRM"
          description="Composições nomeadas reutilizam a mesma base visual, sem uma segunda implementação."
          source="ClienteCard (= CustomerCard), LeadCard, OpportunityCard, ActivityCard, TaskCard, SummaryCard, ChartCard"
          wide
        >
          <div className="ds-grid">
            {[
              ClienteCard,
              LeadCard,
              OpportunityCard,
              ActivityCard,
              TaskCard,
              SummaryCard,
              ChartCard,
            ].map((Component, index) => (
              <Component
                key={index}
                title={
                  [
                    'Cliente',
                    'Contato',
                    'Oportunidade',
                    'Atividade',
                    'Tarefa',
                    'Resumo',
                    'Gráfico',
                  ][index]
                }
                subtitle="Exemplo da família do CRM"
                icon={<FileText size={18} />}
              >
                <Text size="sm">
                  Conteúdo organizado com os tokens compartilhados.
                </Text>
              </Component>
            ))}
          </div>
        </Specimen>
        <Specimen
          title="Pessoas e equipes"
          description="Iniciais quando não há foto; grupos preservam a contagem de pessoas."
          source="Avatar size=xs|sm|md|lg|xl / AvatarGroup / AvatarBadge"
        >
          <div className="ds-row">
            {(['xs', 'sm', 'md', 'lg', 'xl'] as const).map((size) => (
              <Avatar key={size} name="Ana Paula" size={size} />
            ))}
          </div>
          <AvatarGroup max={3}>
            {demoContacts.slice(0, 5).map((contact) => (
              <Avatar key={contact.id} name={contact.name} />
            ))}
          </AvatarGroup>
          <div className="ds-person">
            <div className="relative">
              <Avatar name="Marina Costa" tone="brand" />
              <AvatarBadge>
                <Check size={10} />
              </AvatarBadge>
            </div>
            <Text size="sm">Marina Costa · disponível</Text>
          </div>
        </Specimen>
        <Specimen
          title="Composição e superfícies públicas"
          description="Primitivas já exportadas pelo sistema, disponíveis também fora da área operacional."
          source="Stack / Inline / Heading / Text / PublicShell / PublicSection / PublicCard / PublicEmptyState"
        >
          <Stack gap="md">
            <SectionHeader
              title="Informações relacionadas"
              description="Título e descrição mantêm a mesma hierarquia."
              as="h3"
            />
            <Inline gap="sm">
              <Badge>Contato</Badge>
              <Badge tone="info">Em atendimento</Badge>
            </Inline>
          </Stack>
          <details className="ds-source">
            <summary>Ver composição pública</summary>
            <PublicShell width="narrow">
              <PublicSection tone="muted">
                <PublicCard>
                  <Heading level={3}>Conteúdo público</Heading>
                  <Text size="sm">A mesma identidade visual.</Text>
                </PublicCard>
                <PublicEmptyState
                  title="Nenhum conteúdo disponível"
                  description="Volte mais tarde para consultar novidades."
                />
              </PublicSection>
            </PublicShell>
          </details>
        </Specimen>
      </div>
    </>
  );
}

function Feedback() {
  const { toast } = useToast();
  return (
    <>
      <UsageNote>
        Feedback informa o que aconteceu, o impacto e o próximo passo.
        Confirmações e ausência de dados não são sucesso. Mensagens de erro
        explicam como retomar o trabalho.
      </UsageNote>
      <div className="ds-grid">
        <Specimen
          title="Alertas semânticos"
          description="Mensagens persistentes dentro do contexto da tarefa."
          source="Alert tone=accent | gold | success | warning | danger | info"
          wide
        >
          <div className="ds-form-grid">
            {[
              {
                tone: 'accent',
                title: 'Antes de continuar',
                copy: 'Revise as informações de contato.',
              },
              {
                tone: 'gold',
                title: 'Informação em destaque',
                copy: 'Consulte os detalhes da proposta.',
              },
              {
                tone: 'success',
                title: 'Exemplo concluído',
                copy: 'Os dados demonstrativos foram atualizados.',
              },
              {
                tone: 'warning',
                title: 'Há campos para revisar',
                copy: 'Confira o telefone antes de salvar.',
              },
              {
                tone: 'danger',
                title: 'Não foi possível salvar',
                copy: 'Revise os dados e tente novamente.',
              },
              {
                tone: 'info',
                title: 'Dados de demonstração',
                copy: 'As alterações ficam apenas neste exemplo.',
              },
            ].map((item) => (
              <Alert
                key={item.tone}
                tone={
                  item.tone as
                    | 'accent'
                    | 'gold'
                    | 'success'
                    | 'warning'
                    | 'danger'
                    | 'info'
                }
                title={item.title}
              >
                {item.copy}
              </Alert>
            ))}
          </div>
        </Specimen>
        <Specimen
          title="Notificações temporárias"
          description="Acione os exemplos para testar o toast real e seu fechamento."
          source="Toast / ToastProvider / useToast"
        >
          <Toast
            variant="info"
            title="Uma informação útil"
            description="Mensagens temporárias não substituem erros junto aos campos."
          />
          <div className="ds-row">
            {(['default', 'success', 'error', 'warning', 'info'] as const).map(
              (variant) => (
                <Button
                  key={variant}
                  variant="secondary"
                  size="sm"
                  onClick={() =>
                    toast({
                      variant,
                      title: {
                        default: 'Exemplo de mensagem',
                        success: 'Exemplo concluído',
                        error: 'Falha demonstrativa',
                        warning: 'Revise o exemplo',
                        info: 'Informação do exemplo',
                      }[variant],
                      description:
                        'Mensagem de demonstração. Nenhuma alteração foi enviada ao CRM.',
                      actions:
                        variant === 'error'
                          ? [
                              {
                                label: 'Entendi',
                                onClick: () =>
                                  toast({
                                    variant: 'info',
                                    description:
                                      'Revise as informações antes de tentar novamente.',
                                  }),
                              },
                            ]
                          : undefined,
                    })
                  }
                >
                  {variant === 'default'
                    ? 'Neutro'
                    : variant === 'success'
                      ? 'Sucesso'
                      : variant === 'error'
                        ? 'Erro'
                        : variant === 'warning'
                          ? 'Atenção'
                          : 'Informação'}
                </Button>
              ),
            )}
          </div>
        </Specimen>
        <Specimen
          title="Carregamento e progresso"
          description="Preserve a estrutura enquanto os dados carregam. Use spinner para ações curtas."
          source="Skeleton / LoadingState / Progress"
        >
          <LoadingState
            compact
            label="Carregando contatos"
            description="Preparando a lista para consulta."
          />
          <div className="ds-person">
            <Skeleton variant="avatar" />
            <div className="ds-stack ds-gap-small flex-1">
              <Skeleton />
              <Skeleton />
            </div>
          </div>
          <Skeleton variant="control" />
          <Skeleton variant="table-row" />
          <Progress value={64} showLabel />
          <details className="ds-source">
            <summary>Skeleton de card</summary>
            <Skeleton variant="card" />
          </details>
        </Specimen>
      </div>
    </>
  );
}

function Overlays() {
  const [dialog, setDialog] = useState(false);
  const [workspace, setWorkspace] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [side, setSide] = useState<'left' | 'right' | 'bottom'>('right');
  const [menu, setMenu] = useState(false);
  const [popover, setPopover] = useState(false);
  const [archived, setArchived] = useState(false);
  const [noteDraft, setNoteDraft] = useState('');
  const [savedNote, setSavedNote] = useState('');
  const [noteError, setNoteError] = useState(false);
  const { toast } = useToast();
  return (
    <>
      <UsageNote>
        Modal para uma tarefa curta. Drawer para consultar sem perder a lista.
        Popover para conteúdo contextual. Confirmação explicita o impacto, com
        uma saída clara. Escape fecha e o foco retorna ao acionador.
      </UsageNote>
      <div className="ds-grid">
        <Specimen
          title="Modal de formulário"
          description="Uma anotação curta cabe no modal. Cadastros completos usam FormPage."
          source="Dialog / Field / Textarea / FormActions"
        >
          <Button onClick={() => setDialog(true)}>
            <Plus />
            Adicionar anotação
          </Button>
          <Dialog open={dialog} onOpenChange={setDialog} size="md">
            <DialogHeader onClose={() => setDialog(false)}>
              <DialogTitle>Adicionar anotação</DialogTitle>
              <DialogDescription>
                Registre uma informação curta para o próximo atendimento.
              </DialogDescription>
            </DialogHeader>
            <DialogBody>
              <form
                id="showcase-quick-note"
                noValidate
                onSubmit={(event) => {
                  event.preventDefault();
                  if (!noteDraft.trim()) {
                    setNoteError(true);
                    const field =
                      event.currentTarget.elements.namedItem('note');
                    if (field instanceof HTMLElement) field.focus();
                    return;
                  }
                  setSavedNote(noteDraft.trim());
                  setDialog(false);
                  setNoteError(false);
                  toast({
                    variant: 'success',
                    description: 'Anotação salva apenas neste exemplo.',
                  });
                }}
              >
                <Field
                  label="Anotação do atendimento"
                  required
                  error={
                    noteError && !noteDraft.trim()
                      ? 'Escreva uma anotação para salvar.'
                      : undefined
                  }
                >
                  <Textarea
                    name="note"
                    rows={3}
                    value={noteDraft}
                    onChange={(event) => setNoteDraft(event.target.value)}
                    placeholder="Ex.: prefere atendimento pela manhã"
                  />
                </Field>
              </form>
            </DialogBody>
            <DialogFooter>
              <FormActions
                form="showcase-quick-note"
                submitLabel="Salvar anotação"
                onCancel={() => setDialog(false)}
              />
            </DialogFooter>
          </Dialog>
          {savedNote && (
            <Alert tone="info" title="Última anotação do exemplo">
              {savedNote}
            </Alert>
          )}
        </Specimen>
        <Specimen
          title="Confirmação de ação"
          description="Impacto antes da decisão. Cancelar fica visível para desistir da ação."
          source="ConfirmDialog / Dialog"
        >
          <Badge tone={archived ? 'neutral' : 'info'}>
            {archived ? 'Exemplo arquivado' : 'Exemplo ativo'}
          </Badge>
          <Button
            variant="destructive"
            onClick={() => setConfirm(true)}
            disabled={archived}
          >
            <Trash2 />
            Arquivar exemplo
          </Button>
          {archived && (
            <Button variant="secondary" onClick={() => setArchived(false)}>
              Restaurar exemplo
            </Button>
          )}
          <ConfirmDialog
            open={confirm}
            onOpenChange={setConfirm}
            title="Arquivar este exemplo?"
            description="O item ficará marcado como arquivado nesta demonstração. Você pode restaurá-lo depois."
            confirmLabel="Arquivar exemplo"
            destructive
            closeOnConfirm
            onConfirm={() => {
              setArchived(true);
              toast({
                variant: 'info',
                description:
                  'Exemplo arquivado localmente. Use Restaurar exemplo para desfazer.',
              });
            }}
          />
        </Specimen>
        <Specimen
          title="Drawer de consulta"
          description="Três posições da mesma composição, com título e ações no fechamento."
          source="Drawer side=left | right | bottom / DrawerHeader / DrawerBody / DrawerFooter"
        >
          <Field label="Posição do drawer">
            <Select
              value={side}
              onChange={(event) =>
                setSide(event.target.value as 'left' | 'right' | 'bottom')
              }
              options={[
                { value: 'right', label: 'Direita' },
                { value: 'left', label: 'Esquerda' },
                { value: 'bottom', label: 'Abaixo' },
              ]}
            />
          </Field>
          <Button variant="secondary" onClick={() => setDrawer(true)}>
            Ver detalhes do contato
            <ArrowRight />
          </Button>
          <Drawer open={drawer} onOpenChange={setDrawer} side={side}>
            <DrawerHeader onClose={() => setDrawer(false)}>
              <DialogTitle>Ana Paula Ribeiro</DialogTitle>
              <DialogDescription>
                Consulta rápida do contato demonstrativo.
              </DialogDescription>
            </DrawerHeader>
            <DrawerBody>
              <div className="ds-stack">
                <div className="ds-person">
                  <Avatar name="Ana Paula Ribeiro" />
                  <div>
                    <strong>Ana Paula Ribeiro</strong>
                    <Text size="sm">Amil · plano familiar</Text>
                  </div>
                </div>
                <Badge tone="info">Em atendimento</Badge>
                <dl className="ds-description-list">
                  <div>
                    <dt>E-mail</dt>
                    <dd>ana@example.com</dd>
                  </div>
                  <div>
                    <dt>Telefone</dt>
                    <dd>(11) 99999-0101</dd>
                  </div>
                </dl>
                <Alert tone="info">
                  Nenhuma mensagem é enviada nesta demonstração.
                </Alert>
              </div>
            </DrawerBody>
            <DrawerFooter>
              <Button variant="secondary" onClick={() => setDrawer(false)}>
                Fechar detalhes
              </Button>
            </DrawerFooter>
          </Drawer>
        </Specimen>
        <Specimen
          title="Popover e menu contextual"
          description="Conteúdo próximo ao acionador, sem interromper a tarefa."
          source="Popover / PopoverTrigger / PopoverContent"
        >
          <div className="ds-row">
            <Popover open={popover} onOpenChange={setPopover}>
              <PopoverTrigger>
                <Button variant="secondary">
                  Sobre este status
                  <HelpCircle />
                </Button>
              </PopoverTrigger>
              <PopoverContent aria-label="Sobre o atendimento">
                <div className="ds-stack">
                  <Heading level={3}>Em atendimento</Heading>
                  <Text size="sm">
                    A conversa começou e o contato está recebendo orientação
                    sobre os planos.
                  </Text>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setPopover(false)}
                  >
                    Entendi
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
            <Popover open={menu} onOpenChange={setMenu}>
              <PopoverTrigger>
                <Button variant="secondary" aria-expanded={menu}>
                  Ações
                  <ChevronDown />
                </Button>
              </PopoverTrigger>
              <PopoverContent aria-label="Ações do exemplo">
                <div className="ds-stack ds-gap-small">
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setMenu(false);
                      setDialog(true);
                    }}
                  >
                    <Pencil />
                    Adicionar anotação
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setMenu(false);
                      setDrawer(true);
                    }}
                  >
                    <Users />
                    Ver contato
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => {
                      setMenu(false);
                      setConfirm(true);
                    }}
                  >
                    <Trash2 />
                    Arquivar exemplo
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          </div>
          <Text size="sm">
            Abra e feche por clique, Escape ou clicando fora.
          </Text>
        </Specimen>
        <Specimen
          title="Tooltips"
          description="Ajuda curta para mouse e teclado. Nunca esconda instruções essenciais somente no hover."
          source="Tooltip side=top | right | bottom | left"
        >
          <div className="ds-row">
            {(['top', 'right', 'bottom', 'left'] as const).map((side) => (
              <Tooltip
                key={side}
                side={side}
                content="Ajuda contextual do exemplo"
              >
                <IconButton aria-label={`Ajuda contextual, posição ${side}`}>
                  <HelpCircle />
                </IconButton>
              </Tooltip>
            ))}
          </div>
        </Specimen>
        <Specimen
          title="Modal de área de trabalho"
          description="Apresentação ampla para tarefas que precisam de mais contexto."
          source="WorkspaceDialog / DialogShell"
        >
          <Button variant="secondary" onClick={() => setWorkspace(true)}>
            Abrir área de trabalho
          </Button>
          <WorkspaceDialog
            isOpen={workspace}
            onClose={() => setWorkspace(false)}
            title="Revisar informações"
            description="Exemplo de composição ampla com a mesma estrutura de diálogo."
            size="lg"
            footer={
              <Button variant="secondary" onClick={() => setWorkspace(false)}>
                Fechar revisão
              </Button>
            }
          >
            <Alert tone="info">
              Esta área usa a apresentação de trabalho já disponível no design
              system.
            </Alert>
            <div className="ds-grid">
              <Card>
                <Heading level={3}>Contato</Heading>
                <Text>Ana Paula Ribeiro</Text>
              </Card>
              <Card>
                <Heading level={3}>Operadora</Heading>
                <Text>Amil</Text>
              </Card>
            </div>
          </WorkspaceDialog>
        </Specimen>
      </div>
    </>
  );
}
